import { PropertyDetails, SurveyDetails, ExtentDetails, BoundaryDetails } from '../types';

export interface FormattedScheduleOutput {
  en: string;
  ta: string;
}

/**
 * Formats a list of survey numbers and details.
 */
function formatSurveys(surveys: SurveyDetails[], isTa = false): string {
  if (!surveys || surveys.length === 0) {
    return isTa ? '[சர்வே விவரங்கள் இன்னும் உள்ளிடப்படவில்லை]' : '[No Survey details provided]';
  }

  return surveys.map((s, idx) => {
    const surveyPrefix = isTa ? `வரிசை எண் ${idx + 1}: சர்வே எண்` : `Record ${idx + 1}: Survey No.`;
    const subDivWord = isTa ? 'உட்பிரிவு' : 'Sub-Division';
    const pattaWord = isTa ? 'பட்டா எண்' : 'Patta No.';
    const tslrWord = isTa ? 'TSLR எண்' : 'TSLR No.';
    const chittaWord = isTa ? 'சிட்டா குறிப்பு' : 'Chitta Ref.';

    const parts = [
      `<strong>${s.surveyNo || '————'}</strong>`,
      s.subDivision ? `${subDivWord} <strong>${s.subDivision}</strong>` : '',
      s.pattaNo ? `${pattaWord} <strong>${s.pattaNo}</strong>` : '',
      s.tslrNo ? `${tslrWord} <strong>${s.tslrNo}</strong>` : '',
      s.chittaRef ? `${chittaWord} <strong>${s.chittaRef}</strong>` : ''
    ].filter(Boolean);

    return `${surveyPrefix} ${parts.join(', ')}`;
  }).join(isTa ? '<br/>' : '<br/>');
}

/**
 * Formats boundaries beautifully
 */
function formatBoundaries(boundary: BoundaryDetails, isTa = false): string {
  if (!boundary) return '';
  if (isTa) {
    return `
      <strong>கிழக்கு:</strong> ${boundary.east || '————'}<br/>
      <strong>மேற்கு:</strong> ${boundary.west || '————'}<br/>
      <strong>வடக்கு:</strong> ${boundary.north || '————'}<br/>
      <strong>தெற்கு:</strong> ${boundary.south || '————'}
    `;
  }
  return `
    <strong>East by:</strong> ${boundary.east || '————'}<br/>
    <strong>West by:</strong> ${boundary.west || '————'}<br/>
    <strong>North by:</strong> ${boundary.north || '————'}<br/>
    <strong>South by:</strong> ${boundary.south || '————'}
  `;
}

/**
 * Formats extent values beautifully
 */
function formatExtent(extent: ExtentDetails, isTa = false): string {
  if (!extent) return '';
  const unit = extent.areaUnit || 'Sq.ft';
  if (isTa) {
    const mainExtent = extent.sqft ? `${extent.sqft} சதுர அடி (Sq.Ft)` : '';
    const otherExtent = [];
    if (extent.cent) otherExtent.push(`${extent.cent} சென்ட் (Cent)`);
    if (extent.acre) otherExtent.push(`${extent.acre} ஏக்கர் (Acre)`);
    if (extent.hectare) otherExtent.push(`${extent.hectare} ஹெக்டேர் (Hectare)`);
    
    let result = mainExtent;
    if (otherExtent.length > 0) {
      result += ` [சமமான விஸ்தீரணம்: ${otherExtent.join(', ')}]`;
    }
    
    if (extent.builtUpArea) {
      result += `<br/><strong>கட்டிட விஸ்தீரணம்:</strong> ${extent.builtUpArea} சதுர அடி`;
    }
    if (extent.uds) {
      result += `<br/><strong>பிரிபடாத பாகம் (UDS):</strong> ${extent.uds} சதுர அடி`;
    }
    if (extent.eastWest || extent.northSouth) {
      result += `<br/><strong>அளவுகள்:</strong> கிழக்கு-மேற்கு: ${extent.eastWest || '————'}, வடக்கு-தெற்கு: ${extent.northSouth || '————'}`;
    }
    return result;
  } else {
    const mainExtent = extent.sqft ? `${extent.sqft} Sq.Ft` : '';
    const otherExtent = [];
    if (extent.cent) otherExtent.push(`${extent.cent} Cents`);
    if (extent.acre) otherExtent.push(`${extent.acre} Acres`);
    if (extent.hectare) otherExtent.push(`${extent.hectare} Hectares`);

    let result = mainExtent;
    if (otherExtent.length > 0) {
      result += ` (equivalent to ${otherExtent.join(', ')})`;
    }

    if (extent.builtUpArea) {
      result += `<br/><strong>Built-up Area:</strong> ${extent.builtUpArea} Sq.Ft`;
    }
    if (extent.uds) {
      result += `<br/><strong>Undivided Share of Land (UDS):</strong> ${extent.uds} Sq.Ft`;
    }
    if (extent.eastWest || extent.northSouth) {
      result += `<br/><strong>Dimensions:</strong> East-West: ${extent.eastWest || '————'}, North-South: ${extent.northSouth || '————'}`;
    }
    return result;
  }
}

/**
 * Formats property description schedule for both English and Tamil
 */
export function generatePropertySchedule(
  property: PropertyDetails,
  survey: SurveyDetails,
  surveysList: SurveyDetails[] | undefined,
  extent: ExtentDetails,
  boundary: BoundaryDetails
): FormattedScheduleOutput {
  const activeSurveys = surveysList && surveysList.length > 0 ? surveysList : [survey];

  const enHTML = `
    <div class="space-y-4 text-xs leading-relaxed font-sans">
      <p class="text-center font-bold underline uppercase tracking-wide text-slate-800">
        SCHEDULE OF THE PROPERTY CONVEYED (SCHEDULE "A")
      </p>
      <p>
        All that piece and parcel of land and property bearing 
        ${property.doorNo ? `Door/Plot No. <strong>${property.doorNo}</strong>` : 'Property'}, 
        situated within the Registration District of <strong>${property.registrationDistrict || '————'}</strong>, 
        Revenue District of <strong>${property.district || '————'}</strong>, 
        Sub-Registration District of <strong>${property.sro || '————'}</strong>, 
        situated at Village <strong>${property.village || '————'}</strong>, 
        under Taluk <strong>${property.taluk || '————'}</strong>, 
        ${property.ward ? `Ward: <strong>${property.ward}</strong>` : ''} 
        ${property.block ? `Block: <strong>${property.block}</strong>` : ''} 
        registered as property type <strong>${property.propertyType || 'Residential Plot'}</strong>, and bounded as follows:
      </p>

      <div class="border border-slate-200 bg-slate-50/50 p-3 rounded space-y-2">
        <div>
          <span class="font-bold text-slate-700 block mb-1">Land Surveys & Patta Records:</span>
          ${formatSurveys(activeSurveys, false)}
        </div>
        <div class="border-t border-slate-200/60 pt-2">
          <span class="font-bold text-slate-700 block mb-0.5">Total Extent:</span>
          ${formatExtent(extent, false)}
        </div>
      </div>

      <div class="border border-slate-200 bg-slate-50/50 p-3 rounded">
        <span class="font-bold text-slate-700 block mb-1">Bounded By (Four Boundaries):</span>
        ${formatBoundaries(boundary, false)}
      </div>
    </div>
  `;

  const taHTML = `
    <div class="space-y-4 text-xs leading-relaxed font-sans">
      <p class="text-center font-bold underline uppercase tracking-wide text-slate-800">
        சொத்து விவர அட்டவணை (அட்டவணை "A")
      </p>
      <p>
        <strong>${property.registrationDistrict || '————'}</strong> பதிவு மாவட்டம், 
        <strong>${property.district || '————'}</strong> வருவாய் மாவட்டம், 
        <strong>${property.sro || '————'}</strong> சார்பதிவக எல்லைக்குட்பட்ட, 
        <strong>${property.taluk || '————'}</strong> வட்டம், 
        <strong>${property.village || '————'}</strong> கிராமத்தில் அமைந்ததும், 
        ${property.doorNo ? `கதவு/மனை எண் <strong>${property.doorNo}</strong>` : 'சொத்து'} கொண்டதும், 
        ${property.ward ? `வார்டு: <strong>${property.ward}</strong>` : ''} 
        ${property.block ? `பிளாக்: <strong>${property.block}</strong>` : ''} 
        <strong>${property.propertyType || 'குடியிருப்பு மனை'}</strong> வகையைச் சார்ந்ததுமான கீழ் குறிப்பிட்ட நான்கு எல்லைகளுக்கு உட்பட்ட சொத்து:
      </p>

      <div class="border border-slate-200 bg-slate-50/50 p-3 rounded space-y-2">
        <div>
          <span class="font-bold text-slate-700 block mb-1">வருவாய் நில அளவை மற்றும் பட்டா விவரங்கள்:</span>
          ${formatSurveys(activeSurveys, true)}
        </div>
        <div class="border-t border-slate-200/60 pt-2">
          <span class="font-bold text-slate-700 block mb-0.5">சொத்தின் மொத்த அளவுகள் & விஸ்தீரணம்:</span>
          ${formatExtent(extent, true)}
        </div>
      </div>

      <div class="border border-slate-200 bg-slate-50/50 p-3 rounded">
        <span class="font-bold text-slate-700 block mb-1">நான்கு எல்லைகள் விபரம்:</span>
        ${formatBoundaries(boundary, true)}
      </div>
    </div>
  `;

  return {
    en: enHTML,
    ta: taHTML
  };
}
