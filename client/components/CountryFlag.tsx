import React from 'react';

interface CountryFlagProps {
  countryCode: string;
  className?: string;
}

const CountryFlag: React.FC<CountryFlagProps> = ({ countryCode, className = "" }) => {
  // Get flag icon CSS classes based on country code
  const getFlagIcon = (code: string): JSX.Element => {
    if (!code || code.length !== 2) {
      return (
        <div className="w-4 h-3 bg-slate-400 rounded-sm flex items-center justify-center">
          <span className="text-[8px] text-white font-bold">?</span>
        </div>
      );
    }
    
    const upperCode = code.toUpperCase();
    
    // Create a simple flag representation using CSS gradients and colors
    const getFlagColors = (countryCode: string): { bg: string; accent?: string } => {
      const flagColors: { [key: string]: { bg: string; accent?: string } } = {
        'US': { bg: 'bg-gradient-to-r from-red-500 via-white to-blue-600' },
        'GB': { bg: 'bg-gradient-to-br from-blue-700 via-white to-red-600' },
        'CA': { bg: 'bg-gradient-to-r from-red-500 via-white to-red-500' },
        'DE': { bg: 'bg-gradient-to-b from-black via-red-600 to-yellow-400' },
        'FR': { bg: 'bg-gradient-to-r from-blue-600 via-white to-red-600' },
        'JP': { bg: 'bg-white border border-red-500', accent: 'bg-red-500' },
        'AU': { bg: 'bg-gradient-to-br from-blue-700 via-blue-600 to-blue-800' },
        'BR': { bg: 'bg-gradient-to-br from-green-500 via-yellow-400 to-blue-600' },
        'IN': { bg: 'bg-gradient-to-b from-orange-500 via-white to-green-600' },
        'CN': { bg: 'bg-red-600' },
        'RU': { bg: 'bg-gradient-to-b from-white via-blue-600 to-red-600' },
        'IT': { bg: 'bg-gradient-to-r from-green-600 via-white to-red-600' },
        'ES': { bg: 'bg-gradient-to-b from-red-600 via-yellow-400 to-red-600' },
        'NL': { bg: 'bg-gradient-to-b from-red-600 via-white to-blue-600' },
        'SE': { bg: 'bg-gradient-to-r from-blue-600 via-yellow-400 to-blue-600' },
        'NO': { bg: 'bg-gradient-to-r from-red-600 via-white to-blue-600' },
        'DK': { bg: 'bg-gradient-to-r from-red-600 via-white to-red-600' },
        'FI': { bg: 'bg-gradient-to-r from-white via-blue-600 to-white' },
        'CH': { bg: 'bg-red-600' },
        'AT': { bg: 'bg-gradient-to-b from-red-600 via-white to-red-600' },
        'BE': { bg: 'bg-gradient-to-r from-black via-yellow-400 to-red-600' },
        'IE': { bg: 'bg-gradient-to-r from-green-600 via-white to-orange-500' },
        'PT': { bg: 'bg-gradient-to-r from-green-600 via-red-600 to-red-600' },
        'GR': { bg: 'bg-gradient-to-b from-blue-600 via-white to-blue-600' },
        'PL': { bg: 'bg-gradient-to-b from-white to-red-600' },
        'TR': { bg: 'bg-red-600' },
        'IL': { bg: 'bg-gradient-to-b from-blue-600 via-white to-blue-600' },
        'AE': { bg: 'bg-gradient-to-b from-red-600 via-white to-black' },
        'SA': { bg: 'bg-green-600' },
        'EG': { bg: 'bg-gradient-to-b from-red-600 via-white to-black' },
        'ZA': { bg: 'bg-gradient-to-br from-green-600 via-yellow-400 to-blue-600' },
        'MX': { bg: 'bg-gradient-to-r from-green-600 via-white to-red-600' },
        'AR': { bg: 'bg-gradient-to-b from-blue-400 via-white to-blue-400' },
        'KR': { bg: 'bg-gradient-to-br from-white via-red-600 to-blue-600' },
        'TH': { bg: 'bg-gradient-to-b from-red-600 via-white to-blue-600' },
        'VN': { bg: 'bg-red-600' },
        'MY': { bg: 'bg-gradient-to-b from-red-600 via-white to-blue-600' },
        'SG': { bg: 'bg-gradient-to-b from-red-600 to-white' },
        'ID': { bg: 'bg-gradient-to-b from-red-600 to-white' },
        'PH': { bg: 'bg-gradient-to-b from-blue-600 to-red-600' },
        'NZ': { bg: 'bg-blue-700' },
      };
      
      return flagColors[countryCode] || { bg: 'bg-slate-500' };
    };
    
    const colors = getFlagColors(upperCode);
    
    return (
      <div className={`w-4 h-3 rounded-sm overflow-hidden border border-slate-300 dark:border-slate-600 ${colors.bg} relative`}>
        {colors.accent && (
          <div className={`absolute inset-0 ${colors.accent} opacity-80`}></div>
        )}
        {upperCode === 'JP' && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-red-500 rounded-full"></div>
        )}
        {upperCode === 'CH' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-0.5 bg-white"></div>
            <div className="absolute w-0.5 h-2 bg-white"></div>
          </div>
        )}
        {upperCode === 'TR' && (
          <div className="absolute top-0.5 left-0.5 w-1 h-1 border border-white rounded-full"></div>
        )}
      </div>
    );
  };

  // Get country name for tooltip
  const getCountryName = (code: string): string => {
    const countries: { [key: string]: string } = {
      'US': 'United States',
      'GB': 'United Kingdom',
      'CA': 'Canada',
      'DE': 'Germany',
      'FR': 'France',
      'JP': 'Japan',
      'AU': 'Australia',
      'BR': 'Brazil',
      'IN': 'India',
      'CN': 'China',
      'RU': 'Russia',
      'IT': 'Italy',
      'ES': 'Spain',
      'NL': 'Netherlands',
      'SE': 'Sweden',
      'NO': 'Norway',
      'DK': 'Denmark',
      'FI': 'Finland',
      'CH': 'Switzerland',
      'AT': 'Austria',
      'BE': 'Belgium',
      'IE': 'Ireland',
      'PT': 'Portugal',
      'GR': 'Greece',
      'PL': 'Poland',
      'CZ': 'Czech Republic',
      'HU': 'Hungary',
      'RO': 'Romania',
      'BG': 'Bulgaria',
      'HR': 'Croatia',
      'SK': 'Slovakia',
      'SI': 'Slovenia',
      'EE': 'Estonia',
      'LV': 'Latvia',
      'LT': 'Lithuania',
      'LU': 'Luxembourg',
      'MT': 'Malta',
      'CY': 'Cyprus',
      'TR': 'Turkey',
      'IL': 'Israel',
      'AE': 'United Arab Emirates',
      'SA': 'Saudi Arabia',
      'EG': 'Egypt',
      'ZA': 'South Africa',
      'NG': 'Nigeria',
      'KE': 'Kenya',
      'MA': 'Morocco',
      'TN': 'Tunisia',
      'DZ': 'Algeria',
      'LY': 'Libya',
      'SD': 'Sudan',
      'ET': 'Ethiopia',
      'GH': 'Ghana',
      'UG': 'Uganda',
      'TZ': 'Tanzania',
      'MZ': 'Mozambique',
      'MG': 'Madagascar',
      'ZW': 'Zimbabwe',
      'BW': 'Botswana',
      'NA': 'Namibia',
      'ZM': 'Zambia',
      'MW': 'Malawi',
      'SZ': 'Eswatini',
      'LS': 'Lesotho',
      'MX': 'Mexico',
      'AR': 'Argentina',
      'CL': 'Chile',
      'PE': 'Peru',
      'CO': 'Colombia',
      'VE': 'Venezuela',
      'EC': 'Ecuador',
      'BO': 'Bolivia',
      'PY': 'Paraguay',
      'UY': 'Uruguay',
      'GY': 'Guyana',
      'SR': 'Suriname',
      'KR': 'South Korea',
      'TH': 'Thailand',
      'VN': 'Vietnam',
      'MY': 'Malaysia',
      'SG': 'Singapore',
      'ID': 'Indonesia',
      'PH': 'Philippines',
      'BD': 'Bangladesh',
      'PK': 'Pakistan',
      'LK': 'Sri Lanka',
      'NP': 'Nepal',
      'BT': 'Bhutan',
      'MV': 'Maldives',
      'AF': 'Afghanistan',
      'IR': 'Iran',
      'IQ': 'Iraq',
      'SY': 'Syria',
      'LB': 'Lebanon',
      'JO': 'Jordan',
      'KW': 'Kuwait',
      'QA': 'Qatar',
      'BH': 'Bahrain',
      'OM': 'Oman',
      'YE': 'Yemen',
      'UZ': 'Uzbekistan',
      'KZ': 'Kazakhstan',
      'KG': 'Kyrgyzstan',
      'TJ': 'Tajikistan',
      'TM': 'Turkmenistan',
      'MN': 'Mongolia',
      'NZ': 'New Zealand',
      'FJ': 'Fiji',
      'PG': 'Papua New Guinea',
      'SB': 'Solomon Islands',
      'VU': 'Vanuatu',
      'NC': 'New Caledonia',
      'PF': 'French Polynesia',
      'WS': 'Samoa',
      'TO': 'Tonga',
      'KI': 'Kiribati',
      'TV': 'Tuvalu',
      'NR': 'Nauru',
      'PW': 'Palau',
      'FM': 'Micronesia',
      'MH': 'Marshall Islands'
    };
    
    return countries[code.toUpperCase()] || code.toUpperCase();
  };

  return (
    <div 
      className={`inline-flex items-center ${className}`}
      title={getCountryName(countryCode)}
    >
      {getFlagIcon(countryCode)}
    </div>
  );
};

export default CountryFlag;
