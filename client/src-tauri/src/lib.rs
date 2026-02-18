use std::fs;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
    Manager,
};

const SING_BOX_TUN_JSON: &str = r#"{
  "log": {
    "level": "info",
    "timestamp": true
  },
  "dns": {
    "servers": [
      {
        "tag": "dns-remote",
        "address": "{{primary_dns}}",
        "address_resolver": "dns-local",
        "strategy": "prefer_ipv4",
        "detour": "socks-out"
      },
      {
        "tag": "dns-local",
        "address": "{{secondary_dns}}",
        "detour": "direct-out"
      },
      {
        "tag": "dns-block",
        "address": "rcode://success"
      }
    ],
    "final": "dns-remote",
    "strategy": "prefer_ipv4",
    "disable_cache": false,
    "disable_expire": false
  },
  "inbounds": [
    {
      "type": "tun",
      "tag": "tun-in",
      "interface_name": "CandyConnect",
      "inet4_address": "{{inet4_address}}",
      "inet6_address": "{{inet6_address}}",
      "mtu": {{mtu}},
      "auto_route": true,
      "strict_route": false,
      "sniff": true,
      "sniff_override_destination": false,
      "stack": "gvisor",
      "endpoint_independent_nat": true,
      "platform": {
        "http_proxy": {
          "enabled": true,
          "server": "127.0.0.1",
          "server_port": 2080
        }
      }
    }
  ],
  "outbounds": [
    {
      "type": "socks",
      "tag": "socks-out",
      "server": "{{proxy_host}}",
      "server_port": {{proxy_port}}
    },
    {
      "type": "direct",
      "tag": "direct-out"
    },
    {
      "type": "dns",
      "tag": "dns-out"
    },
    {
      "type": "block",
      "tag": "block-out"
    }
  ],
  "route": {
    "rules": [
      {
        "protocol": "dns",
        "outbound": "dns-out"
      },
      {
        "ip_cidr": [
          "{{server_ip}}/32"
        ],
        "outbound": "direct-out"
      },
      {
        "domain": [
          "{{server_domain}}",
          "gm.litelag.ir"
        ],
        "outbound": "direct-out"
      },
      {{custom_rules}}
    ],
    "final": "socks-out",
    "auto_detect_interface": true
  }
}"#;

#[tauri::command]
async fn generate_sing_box_config(app: tauri::AppHandle, server_address: String) -> Result<String, String> {
    let app_data_dir = app.path().app_data_dir().expect("Failed to get app data directory");
    let settings_path = app_data_dir.join("settings.json");
    
    if !settings_path.exists() {
        return Err("Settings file not found".to_string());
    }

    let settings_content = fs::read_to_string(settings_path).map_err(|e| e.to_string())?;
    let settings: serde_json::Value = serde_json::from_str(&settings_content).map_err(|e| e.to_string())?;

    let mut config = SING_BOX_TUN_JSON.to_string();
    
    // Determine if server_address is IP or domain for routing
    let mut server_ip = "127.0.0.1".to_string();
    let mut server_domain = "localhost".to_string();
    
    if server_address.parse::<std::net::IpAddr>().is_ok() {
        server_ip = server_address.clone();
    } else {
        server_domain = server_address.clone();
        // We'd ideally resolve IP here too, but for routing, domain might suffice if sing-box handles it
    }

    // Handle Custom Rules
    let mut custom_rules = Vec::new();
    if let Some(direct_domains) = settings["customDirectDomains"].as_array() {
        if !direct_domains.is_empty() {
             let domains: Vec<String> = direct_domains.iter().filter_map(|v| v.as_str().map(|s| format!("\"{}\"", s))).collect();
             custom_rules.push(format!("{{ \"domain\": [{}], \"outbound\": \"direct-out\" }}", domains.join(",")));
        }
    }
    if let Some(block_domains) = settings["customBlockDomains"].as_array() {
        if !block_domains.is_empty() {
             let domains: Vec<String> = block_domains.iter().filter_map(|v| v.as_str().map(|s| format!("\"{}\"", s))).collect();
             custom_rules.push(format!("{{ \"domain\": [{}], \"outbound\": \"block-out\" }}", domains.join(",")));
        }
    }
    let custom_rules_str = if custom_rules.is_empty() { "".to_string() } else { format!("{},", custom_rules.join(",")) };

    // Replace placeholders
    config = config.replace("{{primary_dns}}", settings["primaryDns"].as_str().unwrap_or("8.8.8.8"));
    config = config.replace("{{secondary_dns}}", settings["secondaryDns"].as_str().unwrap_or("1.1.1.1"));
    config = config.replace("{{inet4_address}}", settings["tunInet4CIDR"].as_str().unwrap_or("172.19.0.1/30"));
    config = config.replace("{{inet6_address}}", settings["tunInet6CIDR"].as_str().unwrap_or("fdfe:dcba:9876::1/126"));
    config = config.replace("{{mtu}}", &settings["mtu"].as_u64().unwrap_or(9000).to_string());
    config = config.replace("{{proxy_host}}", settings["proxyHost"].as_str().unwrap_or("127.0.0.1"));
    config = config.replace("{{proxy_port}}", &settings["proxyPort"].as_u64().unwrap_or(10808).to_string());
    config = config.replace("{{server_ip}}", &server_ip);
    config = config.replace("{{server_domain}}", &server_domain);
    config = config.replace("{{custom_rules}}", &custom_rules_str);

    Ok(config)
}

#[tauri::command]
async fn start_vpn(
    app: tauri::AppHandle,
    config_json: String,
    mode: String,
) -> Result<(), String> {
    use std::process::{Command, Stdio};
    use std::io::{BufRead, BufReader};
    use std::thread;

    let app_data_dir = app.path().app_data_dir().expect("Failed to get app dir");
    let resource_dir = app.path().resource_dir().unwrap_or_else(|_| std::env::current_dir().unwrap());
    let logs_path = app_data_dir.join("candy.logs");

    // 1. Save Xray config
    let xray_config_path = app_data_dir.join("xray_config.json");
    fs::write(&xray_config_path, &config_json).map_err(|e| e.to_string())?;

    // 2. Determine paths using a more robust search
    let resolve_tool = |base: &std::path::Path, rel_path: &str| -> std::path::PathBuf {
        let p1 = base.join(rel_path);
        if p1.exists() { return p1; }
        let p2 = base.join("resources").join(rel_path);
        if p2.exists() { return p2; }
        p1 // fallback to p1
    };

    let xray_bin = resolve_tool(&resource_dir, if cfg!(target_os = "windows") { "xray/xray.exe" } else { "xray/xray" });
    let sing_box_bin = resolve_tool(&resource_dir, if cfg!(target_os = "windows") { "sing-box/sing-box.exe" } else { "sing-box/sing-box" });

    // 3. Start Xray
    let _ = append_log(&logs_path, "info", &format!("Starting Xray engine: {}", xray_bin.display()));
    
    let mut xray_cmd = Command::new(&xray_bin);
    xray_cmd
        .arg("-c")
        .arg(&xray_config_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // Prevent console window flash on Windows
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        xray_cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let mut xray_child = xray_cmd
        .spawn()
        .map_err(|e| {
            let err_msg = format!("CRITICAL: Failed to spawn Xray: {}", e);
            let _ = append_log(&logs_path, "error", &err_msg);
            err_msg
        })?;

    let _ = append_log(&logs_path, "info", "Xray process spawned successfully");

    // Log Xray output to candy.logs
    let logs_path_clone = logs_path.clone();
    let stdout = xray_child.stdout.take().unwrap();
    let stderr = xray_child.stderr.take().unwrap();
    
    thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines().filter_map(Result::ok) {
            let _ = append_log(&logs_path_clone, "info", &format!("[Xray] {}", line));
        }
    });

    let logs_path_err = logs_path.clone();
    thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines().filter_map(Result::ok) {
            let _ = append_log(&logs_path_err, "error", &format!("[Xray Error] {}", line));
        }
    });

    // Watch Xray exit
    let app_h_xray = app.clone();
    let logs_p_xray_exit = logs_path.clone();
    thread::spawn(move || {
        let _ = xray_child.wait();
        let _ = append_log(&logs_p_xray_exit, "warn", "Xray process has exited.");
        use tauri::Emitter;
        let _ = app_h_xray.emit("vpn-disconnected", ());
    });

    // 4. If TUN mode, also start Sing-box
    if mode == "tun" {
        let _ = append_log(&logs_path, "info", "Initializing TUN mode orchestration...");
        let mut server_address = "127.0.0.1".to_string();
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&config_json) {
            if let Some(outbound) = json["outbounds"].as_array().and_then(|a| a.get(0)) {
               if let Some(vnext) = outbound["settings"]["vnext"].as_array().and_then(|a| a.get(0)) {
                   if let Some(addr) = vnext["address"].as_str() {
                       server_address = addr.to_string();
                   }
               }
            }
        }

        let sb_config = generate_sing_box_config(app.clone(), server_address).await?;
        let sb_config_path = app_data_dir.join("sing_box_config.json");
        fs::write(&sb_config_path, &sb_config).map_err(|e| e.to_string())?;

        let _ = append_log(&logs_path, "info", &format!("Starting Sing-box routing engine: {}", sing_box_bin.display()));

        let mut sb_cmd = Command::new(&sing_box_bin);
        sb_cmd
            .arg("run")
            .arg("-c")
            .arg(&sb_config_path)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        // Prevent console window flash on Windows
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            sb_cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }

        let mut sb_child = sb_cmd
            .spawn()
            .map_err(|e| {
                let err_msg = format!("CRITICAL: Failed to spawn Sing-box: {}", e);
                let _ = append_log(&logs_path, "error", &err_msg);
                err_msg
            })?;

        let _ = append_log(&logs_path, "info", "Sing-box TUN engine spawned successfully");

        let logs_path_sb = logs_path.clone();
        let sb_stdout = sb_child.stdout.take().unwrap();
        let sb_stderr = sb_child.stderr.take().unwrap();
        
        thread::spawn(move || {
            let reader = BufReader::new(sb_stdout);
            for line in reader.lines().filter_map(Result::ok) {
                let _ = append_log(&logs_path_sb, "info", &format!("[Sing-box] {}", line));
            }
        });

        let logs_path_sb_err = logs_path.clone();
        thread::spawn(move || {
            let reader = BufReader::new(sb_stderr);
            for line in reader.lines().filter_map(Result::ok) {
                let _ = append_log(&logs_path_sb_err, "error", &format!("[Sing-box Error] {}", line));
            }
        });

        // Watch Sing-box exit
        let app_h_sb = app.clone();
        let logs_p_sb_exit = logs_path.clone();
        thread::spawn(move || {
            let _ = sb_child.wait();
            let _ = append_log(&logs_p_sb_exit, "warn", "Sing-box process has exited.");
            use tauri::Emitter;
            let _ = app_h_sb.emit("vpn-disconnected", ());
        });
    }

    Ok(())
}

#[tauri::command]
async fn stop_vpn() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let _ = Command::new("taskkill").args(&["/F", "/IM", "xray.exe", "/T"]).spawn();
        let _ = Command::new("taskkill").args(&["/F", "/IM", "sing-box.exe", "/T"]).spawn();
    }
    #[cfg(not(target_os = "windows"))]
    {
        use std::process::Command;
        let _ = Command::new("pkill").arg("-9").arg("-x").arg("xray").spawn();
        let _ = Command::new("pkill").arg("-9").arg("-x").arg("sing-box").spawn();
    }
    Ok(())
}

#[tauri::command]
async fn write_log(app: tauri::AppHandle, level: String, message: String) -> Result<(), String> {
    let app_data_dir = app.path().app_data_dir().expect("Failed to get app dir");
    let logs_path = app_data_dir.join("candy.logs");
    append_log(&logs_path, &level, &message).map_err(|e| e.to_string())
}

fn append_log(path: &std::path::Path, level: &str, message: &str) -> std::io::Result<()> {
    use std::fs::OpenOptions;
    use std::io::Write;

    let log_entry = serde_json::json!({
        "timestamp": chrono::Local::now().to_rfc3339(),
        "level": level,
        "message": message
    });

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)?;

    let line = format!("{}\n", log_entry.to_string());
    file.write_all(line.as_bytes())?;
    Ok(())
}

fn init_app_files(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .expect("Failed to get app data directory");

    // Create the app data directory if it doesn't exist
    if !app_data_dir.exists() {
        fs::create_dir_all(&app_data_dir)?;
    }

    // Initialize settings.json with default values if it doesn't exist
    let settings_path = app_data_dir.join("settings.json");
    if !settings_path.exists() {
        let default_settings = serde_json::json!({
            "autoConnect": false,
            "launchAtStartup": false,
            "selectedProfile": "",
            "selectedProtocol": "v2ray",
            "theme": "light",
            "language": "en",
            "proxyHost": "127.0.0.1",
            "proxyPort": 10808,
            "adBlocking": true,
            "malwareProtection": true,
            "phishingPrevention": false,
            "cryptominerBlocking": false,
            "directCountryAccess": true,
            "v2rayCore": "sing-box",
            "wireguardCore": "amnezia",
            "proxyMode": "proxy",
            "proxyType": "socks",
            "autoReconnect": true,
            "killSwitch": false,
            "dnsLeakProtection": true,
            "splitTunneling": false,
            "tunInet4CIDR": "172.19.0.1/30",
            "tunInet6CIDR": "fdfe:dcba:9876::1/126",
            "mtu": 9000,
            "primaryDns": "8.8.8.8",
            "secondaryDns": "1.1.1.1",
            "customDirectDomains": [],
            "customBlockDomains": []
        });
        fs::write(&settings_path, serde_json::to_string_pretty(&default_settings)?)?;
        log::info!("Created default settings.json");
    }

    // Initialize account.json with empty object if it doesn't exist
    let account_path = app_data_dir.join("account.json");
    if !account_path.exists() {
        let default_account = serde_json::json!({});
        fs::write(&account_path, serde_json::to_string_pretty(&default_account)?)?;
        log::info!("Created default account.json");
    }

    // Initialize candy.logs with empty array if it doesn't exist
    let logs_path = app_data_dir.join("candy.logs");
    if !logs_path.exists() {
        fs::write(&logs_path, "")?;
        log::info!("Created default candy.logs");
    }

    log::info!("App data directory: {:?}", app_data_dir);
    Ok(())
}

#[tauri::command]
async fn measure_latency(host: String) -> Result<u64, String> {
    use std::process::Command;
    
    // Determine the ping command based on the OS
    #[cfg(target_os = "windows")]
    let mut cmd = {
        use std::os::windows::process::CommandExt;
        let mut c = Command::new("ping");
        c.args(&["-n", "1", "-w", "2000", &host]);
        c.creation_flags(0x08000000); // CREATE_NO_WINDOW
        c
    };

    #[cfg(not(target_os = "windows"))]
    let mut cmd = {
        let mut c = Command::new("ping");
        c.args(&["-c", "1", "-W", "2", &host]);
        c
    };

    let output = cmd.output().map_err(|e| e.to_string())?;
    let stdout = String::from_utf8_lossy(&output.stdout);

    if output.status.success() {
        // Parse "time=XXms" or "time=XX ms" from the output
        for line in stdout.lines() {
            if let Some(time_pos) = line.find("time=") {
                let part = &line[time_pos + 5..];
                // Handle cases like "time=14ms" or "time=14.2 ms"
                let end_pos = part.find("ms").unwrap_or_else(|| {
                    part.find(' ').unwrap_or(part.len())
                });
                let time_str = part[..end_pos].trim();
                if let Ok(ms) = time_str.parse::<f64>() {
                    return Ok(ms.round() as u64);
                }
            }
        }
        Err("Could not parse ping time".to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Ping failed: {} {}", stdout, stderr))
    }
}

#[tauri::command]
async fn check_system_executables(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let mut missing = Vec::new();
    let app_dir = app.path().resource_dir().unwrap_or_else(|_| std::env::current_dir().unwrap());
    
    // Check extra-tools subdirectories/files based on workflow structure
    let tools = vec![
        ("xray", if cfg!(target_os = "windows") { "xray/xray.exe" } else { "xray/xray" }),
        ("sing-box", if cfg!(target_os = "windows") { "sing-box/sing-box.exe" } else { "sing-box/sing-box" }),
        ("dnstt", if cfg!(target_os = "windows") { "dnstt-client.exe" } else { "dnstt-client" }),
    ];

    let resolve_tool_check = |base: &std::path::Path, rel_path: &str| -> bool {
        if base.join(rel_path).exists() { return true; }
        if base.join("resources").join(rel_path).exists() { return true; }
        false
    };

    for (name, path) in tools {
        if !resolve_tool_check(&app_dir, path) {
            missing.push(name.to_string());
        }
    }

    #[cfg(target_os = "windows")]
    {
        let ovpn_path = app_dir.join("openvpn/openvpn.exe");
        if !ovpn_path.exists() {
            missing.push("openvpn".to_string());
        }
    }

    Ok(missing)
}

#[tauri::command]
async fn is_admin() -> bool {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        use std::os::windows::process::CommandExt;
        // CREATE_NO_WINDOW = 0x08000000
        let output = Command::new("net")
            .arg("session")
            .creation_flags(0x08000000)
            .output();
        
        match output {
            Ok(out) => out.status.success(),
            Err(_) => false,
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        // On Unix-like systems, check if UID is 0
        unsafe { libc::getuid() == 0 }
    }
}

#[tauri::command]
async fn restart_as_admin(app: tauri::AppHandle) -> Result<(), String> {
    let current_exe = std::env::current_exe().map_err(|e| e.to_string())?;
    
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        // Use PowerShell to start the process with 'runas' verb (triggers UAC)
        let _ = Command::new("powershell")
            .arg("-Command")
            .arg(format!("Start-Process '{}' -Verb RunAs", current_exe.display()))
            .spawn();
            
        app.exit(0);
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        use std::process::Command;
        // Try pkexec for Linux or just sudo for macOS if we have a terminal (usually GUI apps use other ways)
        // For simplicity, we'll try pkexec
        let status = Command::new("pkexec")
            .arg(current_exe)
            .spawn()
            .map_err(|e| e.to_string())?;
        
        app.exit(0);
        Ok(())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // Initialize app data files
      if let Err(e) = init_app_files(app) {
        log::error!("Failed to initialize app files: {}", e);
      }

      // System Tray Setup
      let show_i = MenuItem::with_id(app, "show", "Show CandyConnect", true, None::<&str>)?;
      let quit_i = MenuItem::with_id(app, "quit", "Exit App", true, None::<&str>)?;
      let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

      let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
           "quit" => {
               app.exit(0);
           }
           "show" => {
               if let Some(window) = app.get_webview_window("main") {
                   let _ = window.show();
                   let _ = window.set_focus();
               }
           }
           _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: tauri::tray::MouseButton::Left, .. } = event {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![measure_latency, check_system_executables, is_admin, restart_as_admin, generate_sing_box_config, start_vpn, stop_vpn, write_log])
    .build(tauri::generate_context!())
    .expect("error while building tauri application")
    .run(|app_handle, event| match event {
        tauri::RunEvent::WindowEvent { label, event: tauri::WindowEvent::CloseRequested { api, .. }, .. } => {
            if label == "main" {
                api.prevent_close();
                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
        }
        _ => {}
    });
}
