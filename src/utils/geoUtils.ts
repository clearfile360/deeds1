/**
 * Geographic utility functions for Tamil Nadu Revenue and Registration hierarchies.
 */

// Mapping of Revenue District to compatible Registration Districts
export const REVENUE_TO_REGISTRATION_MAP: Record<string, string[]> = {
  'Chennai': ['Chennai South', 'Chennai North', 'Chennai Central'],
  'Chengalpattu': ['Chengalpattu'],
  'Kanchipuram': ['Kanchipuram', 'Chengalpattu', 'Chennai South'],
  'Vellore': ['Vellore'],
  'Tirupattur': ['Tirupattur'],
  'Tenkasi': ['Tenkasi'],
  'Kallakurichi': ['Kallakurichi'],
  'Mayiladuthurai': ['Mayiladuthurai'],
  'Krishnagiri': ['Krishnagiri'],
  'Salem': ['Salem'],
  'Madurai': ['Madurai'],
  'Tirunelveli': ['Tirunelveli'],
  'Ranipet': ['Ranipet', 'Vellore'],
  'Viluppuram': ['Viluppuram', 'Kallakurichi'],
  'Nagapattinam': ['Nagapattinam', 'Mayiladuthurai'],
};

/**
 * Checks if a selected Registration District is compatible with a selected Revenue District.
 */
export function isRegistrationDistrictCompatible(regDistrict: string, revenueDistrict: string): boolean {
  if (!revenueDistrict) return true;
  if (!regDistrict) return true;
  
  const compatibleRegDistricts = REVENUE_TO_REGISTRATION_MAP[revenueDistrict];
  if (!compatibleRegDistricts) {
    // Fallback: if no specific map exists, we can assume exact match or allow it
    return regDistrict.toLowerCase() === revenueDistrict.toLowerCase();
  }
  
  return compatibleRegDistricts.includes(regDistrict);
}

/**
 * Checks if a selected SRO is compatible with the selected Revenue District.
 */
export function isSroCompatibleWithRevenueDistrict(
  sroName: string,
  regDistrictName: string,
  revenueDistrictName: string
): boolean {
  if (!revenueDistrictName || !regDistrictName || !sroName) return true;
  return isRegistrationDistrictCompatible(regDistrictName, revenueDistrictName);
}
