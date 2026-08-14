import { PartyDetails, WitnessDetails } from '../types';

export interface FormattedPartyOutput {
  en: string;
  ta: string;
  collectiveEn: string;
  collectiveTa: string;
}

/**
 * Formats standard relation prefix and terms
 */
function getRelationPrefix(fatherName: string, age: number, dob?: string): { en: string; ta: string } {
  return {
    en: `S/o or W/o or D/o ${fatherName}`,
    ta: `தந்தை/கணவர்/பாதுகாவலர் பெயர்: ${fatherName}`
  };
}

/**
 * Formats individual parties into descriptive legal paragraphs with proper grammar.
 */
export function formatParties(
  parties: PartyDetails[],
  roleType: 'Seller' | 'Buyer' | 'Donor' | 'Donee' | 'Power Agent' | 'Witness'
): FormattedPartyOutput {
  if (!parties || parties.length === 0) {
    return {
      en: `[No ${roleType} details entered yet]`,
      ta: `[${roleType} விபரங்கள் இன்னும் உள்ளிடப்படவில்லை]`,
      collectiveEn: roleType.toUpperCase(),
      collectiveTa: roleType === 'Seller' ? 'விற்பனையாளர்' : 'வாங்குபவர்'
    };
  }

  // Singular vs Plural labels
  let roleSingularEn = '';
  let rolePluralEn = '';
  let roleSingularTa = '';
  let rolePluralTa = '';

  switch (roleType) {
    case 'Seller':
      roleSingularEn = 'VENDOR';
      rolePluralEn = 'VENDORS';
      roleSingularTa = 'விற்பனையாளர்';
      rolePluralTa = 'விற்பனையாளர்கள்';
      break;
    case 'Buyer':
      roleSingularEn = 'PURCHASER';
      rolePluralEn = 'PURCHASERS';
      roleSingularTa = 'வாங்குபவர்';
      rolePluralTa = 'வாங்குபவர்கள்';
      break;
    case 'Donor':
      roleSingularEn = 'DONOR';
      rolePluralEn = 'DONORS';
      roleSingularTa = 'கொடையாளர்';
      rolePluralTa = 'கொடையாளர்கள்';
      break;
    case 'Donee':
      roleSingularEn = 'DONEE';
      rolePluralEn = 'DONEES';
      roleSingularTa = 'கொடைபெறுபவர்';
      rolePluralTa = 'கொடைபெறுபவர்கள்';
      break;
    case 'Power Agent':
      roleSingularEn = 'POWER AGENT';
      rolePluralEn = 'POWER AGENTS';
      roleSingularTa = 'பொது அதிகார முகவர்';
      rolePluralTa = 'பொது அதிகார முகவர்கள்';
      break;
    default:
      roleSingularEn = 'PARTY';
      rolePluralEn = 'PARTIES';
      roleSingularTa = 'தரப்பினர்';
      rolePluralTa = 'தரப்பினர்கள்';
  }

  const individualEnTexts = parties.map((p, idx) => {
    const prefix = p.name.startsWith('M.') || p.name.startsWith('R.') || p.name.startsWith('S.') ? '' : 'Mr./Mrs./Ms. ';
    const rel = p.fatherName ? `son/daughter/wife of Mr. ${p.fatherName}` : '';
    const ageStr = p.age ? `aged about ${p.age} years` : '';
    const occStr = p.occupation ? `by occupation ${p.occupation}` : '';
    const adrStr = p.address ? `residing at ${p.address}` : '';
    const aadhStr = p.aadhaar ? `holder of Aadhaar Card bearing No. ${p.aadhaar}` : '';
    const panStr = p.pan ? `and PAN bearing No. ${p.pan}` : '';
    
    const details = [rel, ageStr, occStr, adrStr, aadhStr, panStr].filter(Boolean).join(', ');
    const label = parties.length > 1 ? `the ${idx + 1}<sup>st</sup> ${roleSingularEn}` : `the ${roleSingularEn}`;
    
    return `<strong>${prefix}${p.name}</strong>, ${details} (hereinafter called ${label})`;
  });

  const individualTaTexts = parties.map((p, idx) => {
    const rel = p.fatherName ? `தந்தை/கணவர் பெயர்: திரு. ${p.fatherName}` : '';
    const ageStr = p.age ? `சுமார் ${p.age} வயதுடைய` : '';
    const occStr = p.occupation ? `தொழில்: ${p.occupation}` : '';
    const adrStr = p.address ? `விலாசம்: ${p.address}` : '';
    const aadhStr = p.aadhaar ? `ஆதார் எண்: ${p.aadhaar}` : '';
    const panStr = p.pan ? `மற்றும் PAN எண்: ${p.pan}` : '';
    
    const details = [rel, ageStr, occStr, adrStr, aadhStr, panStr].filter(Boolean).join(', ');
    const label = parties.length > 1 ? `${idx + 1}வது ${roleSingularTa}` : `${roleSingularTa}`;
    
    return `<strong>திரு/திருமதி ${p.name}</strong>, ${details} (இனிமேல் இவரை இக்கிரயப் பத்திரத்தில் "<strong>${label}</strong>" என்று குறிப்பிடப்படும்)`;
  });

  let enResult = '';
  let taResult = '';

  if (parties.length === 1) {
    enResult = individualEnTexts[0];
    taResult = individualTaTexts[0];
  } else {
    enResult = individualEnTexts.map((text, i) => `(${i + 1}) ${text}`).join(' AND ');
    enResult += ` (hereinafter collectively referred to as the <strong>${rolePluralEn}</strong>, which expression shall unless repugnant to the context mean and include their respective heirs, legal representatives, executors, administrators, and assigns).`;

    taResult = individualTaTexts.map((text, i) => `(${i + 1}) ${text}`).join(' மற்றும் ');
    taResult += ` (இனிமேல் இவர்கள் அனைவரும் கூட்டாக "<strong>${rolePluralTa}</strong>" என்று அழைக்கப்படுவார்கள். இந்த சொற்றொடர் இவர்களின் சட்டபூர்வமான வாரிசுகள் மற்றும் பிரதிநிதிகளையும் குறிக்கும்).`;
  }

  return {
    en: enResult,
    ta: taResult,
    collectiveEn: parties.length > 1 ? rolePluralEn : roleSingularEn,
    collectiveTa: parties.length > 1 ? rolePluralTa : roleSingularTa
  };
}

/**
 * Formats witnesses list
 */
export function formatWitnesses(witnesses: WitnessDetails[]): { en: string; ta: string } {
  if (!witnesses || witnesses.length === 0) {
    return {
      en: 'No witnesses added. Minimum of two witnesses are legally required for sub-registry execution.',
      ta: 'சாட்சிகள் இன்னும் சேர்க்கப்படவில்லை. பத்திரம் பதிவு செய்ய குறைந்தபட்சம் இரண்டு சாட்சிகள் சட்டப்படி அவசியமாகும்.'
    };
  }

  const enList = witnesses.map((w, idx) => {
    const parent = w.fatherName ? `S/o or D/o Mr. ${w.fatherName}` : '';
    const age = w.age ? `aged about ${w.age} years` : '';
    const addr = w.address ? `residing at ${w.address}` : '';
    const details = [parent, age, addr].filter(Boolean).join(', ');
    return `<strong>${idx + 1}. ${w.name}</strong>, ${details}.`;
  });

  const taList = witnesses.map((w, idx) => {
    const parent = w.fatherName ? `தந்தை பெயர்: திரு. ${w.fatherName}` : '';
    const age = w.age ? `சுமார் ${w.age} வயதுடைய` : '';
    const addr = w.address ? `முகவரி: ${w.address}` : '';
    const details = [parent, age, addr].filter(Boolean).join(', ');
    return `<strong>${idx + 1}. திரு/திருமதி ${w.name}</strong>, ${details}.`;
  });

  return {
    en: enList.join('<br/><br/>'),
    ta: taList.join('<br/><br/>')
  };
}
