// countries.js - List of countries and regions for team organization

const COUNTRIES_AND_REGIONS = {
  // Европа как отдельная "страна"
  'Europe-region': {
    flag: '🇪🇺',
    region: 'Europe',
    countries: [
      { name: 'Europe', flag: '🇪🇺', iso2: 'eu' }, // Европа как сама по себе страна
      { name: 'Sweden', flag: '🇸🇪', iso2: 'se' },
      { name: 'Denmark', flag: '🇩🇰', iso2: 'dk' },
      { name: 'Poland', flag: '🇵🇱', iso2: 'pl' },
      { name: 'Germany', flag: '🇩🇪', iso2: 'de' },
      { name: 'France', flag: '🇫🇷', iso2: 'fr' },
      { name: 'Spain', flag: '🇪🇸', iso2: 'es' },
      { name: 'Portugal', flag: '🇵🇹', iso2: 'pt' },
      { name: 'Italy', flag: '🇮🇹', iso2: 'it' },
      { name: 'Czech Republic', flag: '🇨🇿', iso2: 'cz' },
      { name: 'Hungary', flag: '🇭🇺', iso2: 'hu' },
      { name: 'Romania', flag: '🇷🇴', iso2: 'ro' },
      { name: 'Ukraine', flag: '🇺🇦', iso2: 'ua' },
      { name: 'Russia', flag: '🇷🇺', iso2: 'ru' },
      { name: 'Belarus', flag: '🇧🇾', iso2: 'by' },
      { name: 'Greece', flag: '🇬🇷', iso2: 'gr' },
      { name: 'Austria', flag: '🇦🇹', iso2: 'at' },
      { name: 'Switzerland', flag: '🇨🇭', iso2: 'ch' },
      { name: 'Netherlands', flag: '🇳🇱', iso2: 'nl' },
      { name: 'Belgium', flag: '🇧🇪', iso2: 'be' },
      { name: 'Norway', flag: '🇳🇴', iso2: 'no' },
      { name: 'Finland', flag: '🇫🇮', iso2: 'fi' },
      { name: 'United Kingdom', flag: '🇬🇧', iso2: 'gb' },
      { name: 'Ireland', flag: '🇮🇪', iso2: 'ie' },
      { name: 'Iceland', flag: '🇮🇸', iso2: 'is' },
      { name: 'Serbia', flag: '🇷🇸', iso2: 'rs' },
      { name: 'Croatia', flag: '🇭🇷', iso2: 'hr' },
      { name: 'Bosnia', flag: '🇧🇦', iso2: 'ba' },
      { name: 'Turkey', flag: '🇹🇷', iso2: 'tr' }
    ]
  },
  // Северная Америка
  'North America': {
    flag: '🇺🇸',
    region: 'North America',
    countries: [
      { name: 'United States', flag: '🇺🇸', iso2: 'us' },
      { name: 'Canada', flag: '🇨🇦', iso2: 'ca' },
      { name: 'Mexico', flag: '🇲🇽', iso2: 'mx' }
    ]
  },
  // Южная Америка
  'South America': {
    flag: '🇧🇷',
    region: 'South America',
    countries: [
      { name: 'Brazil', flag: '🇧🇷', iso2: 'br' },
      { name: 'Argentina', flag: '🇦🇷', iso2: 'ar' },
      { name: 'Chile', flag: '🇨🇱', iso2: 'cl' },
      { name: 'Peru', flag: '🇵🇪', iso2: 'pe' },
      { name: 'Colombia', flag: '🇨🇴', iso2: 'co' },
      { name: 'Uruguay', flag: '🇺🇾', iso2: 'uy' }
    ]
  },
  // Азия
  'Asia': {
    flag: '🇨🇳',
    region: 'Asia',
    countries: [
      { name: 'China', flag: '🇨🇳', iso2: 'cn' },
      { name: 'Japan', flag: '🇯🇵', iso2: 'jp' },
      { name: 'South Korea', flag: '🇰🇷', iso2: 'kr' },
      { name: 'Mongolia', flag: '🇲🇳', iso2: 'mn' },
      { name: 'India', flag: '🇮🇳', iso2: 'in' },
      { name: 'Pakistan', flag: '🇵🇰', iso2: 'pk' },
      { name: 'Thailand', flag: '🇹🇭', iso2: 'th' },
      { name: 'Vietnam', flag: '🇻🇳', iso2: 'vn' },
      { name: 'Philippines', flag: '🇵🇭', iso2: 'ph' },
      { name: 'Indonesia', flag: '🇮🇩', iso2: 'id' },
      { name: 'Malaysia', flag: '🇲🇾', iso2: 'my' },
      { name: 'Singapore', flag: '🇸🇬', iso2: 'sg' },
      { name: 'Hong Kong', flag: '🇭🇰', iso2: 'hk' },
      { name: 'Taiwan', flag: '🇹🇼', iso2: 'tw' }
    ]
  },
  // Ближний Восток
  'Middle East': {
    flag: '🇸🇦',
    region: 'Middle East',
    countries: [
      { name: 'Saudi Arabia', flag: '🇸🇦', iso2: 'sa' },
      { name: 'UAE', flag: '🇦🇪', iso2: 'ae' },
      { name: 'Israel', flag: '🇮🇱', iso2: 'il' },
      { name: 'Iran', flag: '🇮🇷', iso2: 'ir' },
      { name: 'Iraq', flag: '🇮🇶', iso2: 'iq' }
    ]
  },
  // Африка
  'Africa': {
    flag: '🇿🇦',
    region: 'Africa',
    countries: [
      { name: 'South Africa', flag: '🇿🇦', iso2: 'za' },
      { name: 'Egypt', flag: '🇪🇬', iso2: 'eg' },
      { name: 'Nigeria', flag: '🇳🇬', iso2: 'ng' },
      { name: 'Kenya', flag: '🇰🇪', iso2: 'ke' }
    ]
  },
  // Австралия и Океания
  'Oceania': {
    flag: '🇦🇺',
    region: 'Oceania',
    countries: [
      { name: 'Australia', flag: '🇦🇺', iso2: 'au' },
      { name: 'New Zealand', flag: '🇳🇿', iso2: 'nz' }
    ]
  }
};

// Get flat list of all countries
function getAllCountries() {
  const allCountries = [];
  Object.values(COUNTRIES_AND_REGIONS).forEach(region => {
    allCountries.push(...region.countries);
  });
  return allCountries;
}

// Get region by country name
function getRegionByCountry(countryName) {
  if (countryName === 'Europe') return 'Europe'; // Europe как страна映射到Europe регион
  for (const [regionKey, regionData] of Object.entries(COUNTRIES_AND_REGIONS)) {
    const country = regionData.countries.find(c => c.name === countryName);
    if (country) {
      return regionData.region;
    }
  }
  return null;
}

// Get flag by country name
function getFlagByCountry(countryName) {
  const country = getAllCountries().find(c => c.name === countryName);
  return country ? country.flag : '🏳';
}

// Return a FlagCDN URL (PNG) for a country by name. size may be 'w20','w40' etc or numeric px e.g. 20 -> w20
function getFlagUrlByCountry(countryName, size) {
  const country = getAllCountries().find(c => c.name === countryName);
  if (!country) return '';
  const iso = (country.iso2 || '').toLowerCase();
  if (!iso) return '';
  // FlagCDN supports specific widths (w20, w40, w80, w160). Map requested size to nearest supported.
  const allowed = ['w20','w40','w80','w160'];
  let sizePart = 'w20';
  if (typeof size === 'number') {
    if (size <= 20) sizePart = 'w20';
    else if (size <= 40) sizePart = 'w40';
    else if (size <= 80) sizePart = 'w80';
    else sizePart = 'w160';
  } else if (typeof size === 'string') {
    const s = size.toLowerCase();
    if (allowed.includes(s)) sizePart = s;
    else {
      const m = s.match(/w(\d+)/);
      if (m && m[1]) {
        const n = parseInt(m[1], 10);
        if (n <= 20) sizePart = 'w20';
        else if (n <= 40) sizePart = 'w40';
        else if (n <= 80) sizePart = 'w80';
        else sizePart = 'w160';
      }
    }
  }
  return `https://flagcdn.com/${sizePart}/${iso}.png`;
}

// Helper returning an <img> tag string for small flags (can be inserted into innerHTML).
function getFlagImgTag(countryName, sizePx = 20, className = '') {
  const url = getFlagUrlByCountry(countryName, sizePx);
  if (!url) return '';
  const safeName = (countryName || '').replace(/"/g, '&quot;');
  const height = Math.round(sizePx * 0.66);
  return `<img src="${url}" width="${sizePx}" height="${height}" alt="${safeName}" class="${className}" style="vertical-align:middle; margin-right:6px;">`;
}

// Get flag by region name
function getFlagByRegion(regionName) {
  const region = Object.values(COUNTRIES_AND_REGIONS).find(r => r.region === regionName);
  return region ? region.flag : '🌍';
}

// Expose to window for pages that expect globals (select init uses window.COUNTRIES_AND_REGIONS)
if (typeof window !== 'undefined') {
  window.COUNTRIES_AND_REGIONS = COUNTRIES_AND_REGIONS;
  window.getAllCountries = getAllCountries;
  window.getRegionByCountry = getRegionByCountry;
  window.getFlagByCountry = getFlagByCountry;
  window.getFlagByRegion = getFlagByRegion;
  window.getFlagUrlByCountry = getFlagUrlByCountry;
  window.getFlagImgTag = getFlagImgTag;
}
