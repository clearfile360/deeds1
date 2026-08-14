import { DeedWizardState, PartyDetails, WitnessDetails, SurveyDetails } from '../types';

// ============================================================================
// 10. EXTERNAL CONNECTOR READY ARCHITECTURE
// ============================================================================

/**
 * Generic abstraction interface for external system integrations.
 * Allows switching providers (e.g., government APIs, third-party OCR, bank APIs)
 * without modifying core validation engines.
 */
export interface ExternalConnector<TInput, TOutput> {
  id: string;
  name: string;
  providerName: string;
  version: string;
  description: string;
  verify(input: TInput): Promise<TOutput>;
}

// 1. UIDAI Aadhaar Gateway Connector (Simulated)
export interface AadhaarVerificationResult {
  status: 'Verified' | 'Failed' | 'Suspicious';
  maskedAadhaar: string;
  dobMatch: boolean;
  isRegisteredMobile: boolean;
  errMessage?: string;
}

export class UIDAIAadhaarConnector implements ExternalConnector<string, AadhaarVerificationResult> {
  id = 'uidai-aadhaar-gateway';
  name = 'UIDAI Biometric & OTP Aadhaar Gateway';
  providerName = 'Unique Identification Authority of India (UIDAI)';
  version = '3.2-STAR2.0-Compatible';
  description = 'Direct OTP-based identity verification of 12-digit Aadhaar credentials against national biometric archives.';

  async verify(aadhaar: string): Promise<AadhaarVerificationResult> {
    const clean = aadhaar.replace(/-/g, '');
    
    // Check repeating placeholders
    if (/^1111|^1234|^9999|^0000/.test(clean) || clean.length !== 12) {
      return {
        status: 'Suspicious',
        maskedAadhaar: 'XXXX-XXXX-invalid',
        dobMatch: false,
        isRegisteredMobile: false,
        errMessage: 'Suspicious Sequence: Credentials triggered biometric integrity warnings.'
      };
    }
    
    return {
      status: 'Verified',
      maskedAadhaar: `XXXX-XXXX-${clean.substring(8)}`,
      dobMatch: true,
      isRegisteredMobile: true
    };
  }
}

// 2. NSDL PAN Verification Connector (Simulated)
export interface PanVerificationResult {
  status: 'Verified' | 'Failed' | 'Invalid_Format';
  taxpayerName?: string;
  category?: string;
  isValid: boolean;
}

export class NsdlPanConnector implements ExternalConnector<string, PanVerificationResult> {
  id = 'nsdl-pan-taxpayer-query';
  name = 'NSDL Taxpayer & PAN Database Check';
  providerName = 'Protean eGov Technologies Limited (formerly NSDL)';
  version = 'v2.1';
  description = 'Cross-checks structural validity of the 10-character alphanumeric PAN key against the Central Board of Direct Taxes (CBDT) registry.';

  async verify(pan: string): Promise<PanVerificationResult> {
    const upper = pan.trim().toUpperCase();
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(upper)) {
      return { status: 'Invalid_Format', isValid: false };
    }
    
    // Simulate naming matching
    return {
      status: 'Verified',
      isValid: true,
      taxpayerName: 'AUTOMATIC REGISTRY MATCH',
      category: upper.charAt(3) === 'P' ? 'Individual' : 'Corporate / Firm'
    };
  }
}

// 3. STAR 2.0 Guideline Database Connector (Simulated)
export interface GuidelineQueryResult {
  guidelineValuePerSqft: number;
  marketSroDiscrepancy: boolean;
  status: 'Matched' | 'Under_Valued' | 'Unverified_Survey';
}

export class TnreginetGuidelineConnector implements ExternalConnector<{ district: string; village: string; surveyNo: string }, GuidelineQueryResult> {
  id = 'tnreginet-guideline-service';
  name = 'TNreginet STAR 2.0 Guideline Database Query';
  providerName = 'Tamil Nadu Registration Department (TNreginet)';
  version = 'STAR-2.0-v4.9';
  description = 'Retrieves public registry land guideline valuations indexed by survey subdivision coordinates.';

  async verify(input: { district: string; village: string; surveyNo: string }): Promise<GuidelineQueryResult> {
    const { district, village } = input;
    const distLower = district.toLowerCase();
    const villLower = village.toLowerCase();

    // Default rate per sqft simulated by village
    let rate = 1500;
    if (villLower.includes('mylapore')) rate = 4500;
    else if (villLower.includes('chitlapakkam') || villLower.includes('tambaram')) rate = 2800;
    else if (distLower.includes('chennai')) rate = 3500;

    return {
      guidelineValuePerSqft: rate,
      marketSroDiscrepancy: false,
      status: 'Matched'
    };
  }
}

// 4. e-Sevai Patta Mutation Gateway (Simulated)
export interface PattaRecordResult {
  status: 'Verified' | 'Mismatch' | 'Record_Not_Found';
  ownerNameEn: string;
  landClassification: 'Ryotwari Dry' | 'Ryotwari Wet' | 'Nanjai' | 'Punjai' | 'Grama Natham' | 'Prohibited / Government';
  totalExtentSqft: number;
}

export class ESevaiPattaConnector implements ExternalConnector<{ pattaNo: string; village: string; surveyNo: string }, PattaRecordResult> {
  id = 'esevai-patta-mutation-service';
  name = 'e-Sevai Patta/Chitta Mutation Registry Gateway';
  providerName = 'Tamil Nadu Revenue Department (e-District / Any-Any)';
  version = 'v3.5';
  description = 'Live verification of Land ownership record (ROR), Patta registers, and land classifications on Tamil Nadu revenue systems.';

  async verify(input: { pattaNo: string; village: string; surveyNo: string }): Promise<PattaRecordResult> {
    const patta = input.pattaNo.trim();
    const key = `${input.surveyNo}`;
    
    // Special Prohibited cases
    if (key === '142/3A' || key === '89/1B') {
      return {
        status: 'Mismatch',
        ownerNameEn: 'SRO EXCLUDED HOLDING / COURT INJUNCTION',
        landClassification: 'Prohibited / Government',
        totalExtentSqft: 0
      };
    }

    if (!/^\d+$/.test(patta)) {
      return {
        status: 'Record_Not_Found',
        ownerNameEn: '',
        landClassification: 'Ryotwari Dry',
        totalExtentSqft: 0
      };
    }

    return {
      status: 'Verified',
      ownerNameEn: 'PRIMARY TRANSACTIONAL OWNER',
      landClassification: 'Ryotwari Dry',
      totalExtentSqft: 2400
    };
  }
}

// 5. EC Registry Ledger Connector (Simulated)
export interface EcVerificationResult {
  status: 'Verified_Clean' | 'Lien_Mortgage_Detected' | 'Double_Registration' | 'Unverified';
  ecPeriodYears: number;
  encumbranceDetails: string[];
}

export class EcRegistryConnector implements ExternalConnector<{ parentDocNo: string; parentDocYear: string; surveyNo: string }, EcVerificationResult> {
  id = 'star20-ec-ledger-connector';
  name = 'STAR 2.0 Encumbrance Certificate (EC) Ledger';
  providerName = 'Sub-Registrar Office Archives (STAR 2.0)';
  version = 'v2.0-secure';
  description = 'Scans historic registers over 30 years to map deed chains and uncover hidden mortgages, court orders, or liens.';

  async verify(input: { parentDocNo: string; parentDocYear: string; surveyNo: string }): Promise<EcVerificationResult> {
    const { surveyNo, parentDocNo } = input;
    
    if (surveyNo === '142/3A' || surveyNo === '89/1B') {
      return {
        status: 'Double_Registration',
        ecPeriodYears: 30,
        encumbranceDetails: ['Active court dispute logged in Oct 2024. Injunction order halts title transfer.']
      };
    }

    if (!parentDocNo) {
      return {
        status: 'Unverified',
        ecPeriodYears: 0,
        encumbranceDetails: ['Missing Parent Deed coordinates. EC cannot trace title chain.']
      };
    }

    return {
      status: 'Verified_Clean',
      ecPeriodYears: 30,
      encumbranceDetails: []
    };
  }
}

// ============================================================================
// STRUCTURAL VERIFICATION RESULT TYPES
// ============================================================================

export interface VerificationModuleResult<TStatus = any> {
  status: TStatus;
  passed: boolean;
  details: string[];
  alerts: { message: string; severity: 'critical' | 'high' | 'moderate' | 'low'; fix: string }[];
}

export interface ComprehensiveVerificationResult {
  identityResult: VerificationModuleResult<'Verified' | 'Partially Verified' | 'Unverified' | 'Suspicious'>;
  propertyResult: VerificationModuleResult<'Verified' | 'Partially Verified' | 'Unverified' | 'Suspicious'>;
  ownershipResult: VerificationModuleResult<'Verified' | 'Partially Verified' | 'Unverified' | 'Suspicious'>;
  financialResult: VerificationModuleResult<'Verified' | 'Partially Verified' | 'Unverified' | 'Suspicious'>;
  fraudResult: VerificationModuleResult<'Verified' | 'Partially Verified' | 'Unverified' | 'Suspicious'>;
  trustScore: number;
  trustBand: 'Trusted' | 'Review Recommended' | 'Suspicious' | 'High Risk';
  scoreBreakdown: {
    identity: number; // Max 25
    property: number; // Max 25
    ownership: number; // Max 20
    financial: number; // Max 15
    fraud: number; // Max 15
  };
}

// ============================================================================
// MODULAR VERIFICATION SERVICES
// ============================================================================

/**
 * IDENTITY VERIFICATION ENGINE
 */
export function verifyIdentity(state: DeedWizardState): VerificationModuleResult<'Verified' | 'Partially Verified' | 'Unverified' | 'Suspicious'> {
  const details: string[] = [];
  const alerts: VerificationModuleResult['alerts'] = [];
  
  const parties = state.parties || [];
  const witnesses = state.witnesses || [];

  if (parties.length === 0) {
    alerts.push({
      message: 'No active executing parties assigned to this transaction.',
      severity: 'critical',
      fix: 'Navigate to Step 2 and add Buyer/Seller or Donor/Donee identities.'
    });
    return { status: 'Unverified', passed: false, details: ['Parties list is empty'], alerts };
  }

  let totalScore = 100;
  let placeholderCount = 0;
  let invalidPanCount = 0;
  let duplicateCount = 0;

  // Audit parties
  parties.forEach((p, idx) => {
    const role = p.role || 'Party';
    const name = p.name || `Party #${idx + 1}`;
    
    // PAN Format Check
    if (p.pan) {
      if (/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(p.pan.toUpperCase())) {
        details.push(`PAN format valid for ${role}: ${name}`);
      } else {
        invalidPanCount++;
        totalScore -= 10;
        alerts.push({
          message: `Tax alert: Invalid PAN format "${p.pan}" for ${name}. Expected alphanumeric sequence (e.g. ABCDE1234F).`,
          severity: 'moderate',
          fix: 'Go to Step 2 and correct the PAN string according to standard Income Tax Department codes.'
        });
      }
    } else {
      totalScore -= 5;
      alerts.push({
        message: `PAN ID missing for executing party ${name}. Mandatory for all property transfers exceeding Rs. 5 Lakhs.`,
        severity: 'high',
        fix: 'Provide the permanent account number in Step 2 to avoid statutory tax holds.'
      });
    }

    // Aadhaar check
    if (p.aadhaar) {
      const cleanAadhaar = p.aadhaar.replace(/-/g, '');
      const isPlaceholder = /^1111|^1234|^9999|^0000/.test(cleanAadhaar) || cleanAadhaar.length < 12;
      
      if (isPlaceholder) {
        placeholderCount++;
        totalScore -= 20;
        alerts.push({
          message: `Aadhaar Forgery Risk: Simulated/Placeholder Aadhaar ID "${p.aadhaar}" discovered for ${name}.`,
          severity: 'critical',
          fix: 'Go to Step 2 and supply a certified 12-digit UIDAI identity string.'
        });
      } else {
        details.push(`Aadhaar structure correct (Masked) for ${role}: ${name}`);
      }
    } else {
      totalScore -= 10;
      alerts.push({
        message: `Aadhaar ID missing for executing party ${name}. Required under Tamil Nadu Registration Rules.`,
        severity: 'high',
        fix: 'Go to Step 2 and specify the 12-digit Aadhaar number.'
      });
    }

    // Mobile verification readiness
    if (p.phone) {
      if (/^[6-9][0-9]{9}$/.test(p.phone)) {
        details.push(`Mobile OTP channel verified for ${name} (${p.phone})`);
      } else {
        totalScore -= 5;
        alerts.push({
          message: `Mobile format anomaly for ${name}: Phone "${p.phone}" must contain exactly 10 digits starting with 6-9.`,
          severity: 'moderate',
          fix: 'Correct the mobile phone entry in Step 2.'
        });
      }
    } else {
      totalScore -= 10;
      alerts.push({
        message: `Mobile phone missing for ${name}. OTP-driven verification required under STAR 2.0.`,
        severity: 'high',
        fix: 'Input the executing party phone number in Step 2.'
      });
    }
  });

  // Check Duplicate identities
  parties.forEach((p1, idx1) => {
    parties.forEach((p2, idx2) => {
      if (idx1 < idx2) {
        const panMatch = p1.pan && p2.pan && p1.pan.trim().toUpperCase() === p2.pan.trim().toUpperCase();
        const aadhaarMatch = p1.aadhaar && p2.aadhaar && p1.aadhaar.replace(/-/g, '') === p2.aadhaar.replace(/-/g, '');
        
        if ((panMatch || aadhaarMatch) && p1.role !== p2.role) {
          duplicateCount++;
          totalScore -= 25;
          alerts.push({
            message: `Conflict of Interest: Aadhaar/PAN duplication. "${p1.name}" registered as both ${p1.role} and ${p2.role}.`,
            severity: 'critical',
            fix: 'Go to Step 2 and verify individual distinct profiles. No single person can represent conflicting sides.'
          });
        }
      }
    });
  });

  // Verify witnesses count
  if (witnesses.length < 2) {
    totalScore -= 15;
    alerts.push({
      message: `Statutory Witness Gap: Only ${witnesses.length} witnesses registered. TN registration code requires at least 2 signing witnesses.`,
      severity: 'high',
      fix: 'Navigate to Step 9 and add a minimum of two verified witnesses.'
    });
  } else {
    details.push(`Witness quorum met. Recorded witnesses: ${witnesses.length}`);
  }

  // Set modular status
  let status: 'Verified' | 'Partially Verified' | 'Unverified' | 'Suspicious' = 'Verified';
  if (placeholderCount > 0 || duplicateCount > 0) status = 'Suspicious';
  else if (invalidPanCount > 0 || witnesses.length < 2) status = 'Partially Verified';
  else if (parties.length === 0) status = 'Unverified';

  return {
    status,
    passed: status === 'Verified' || status === 'Partially Verified',
    details,
    alerts
  };
}

/**
 * PROPERTY VERIFICATION ENGINE
 */
export function verifyProperty(state: DeedWizardState): VerificationModuleResult<'Verified' | 'Partially Verified' | 'Unverified' | 'Suspicious'> {
  const details: string[] = [];
  const alerts: VerificationModuleResult['alerts'] = [];

  const prop = state.property || {};
  const surveys = state.surveys || (state.survey ? [state.survey] : []);

  if (!prop.district || !prop.taluk || !prop.village || !prop.sro) {
    alerts.push({
      message: 'Critical geographic hierarchy variables are incomplete.',
      severity: 'critical',
      fix: 'Navigate to Step 3 and complete Revenue District, Taluk, Village, and SRO Office settings.'
    });
    return { status: 'Unverified', passed: false, details: ['Missing property location metrics'], alerts };
  }

  details.push(`Property geography verified under taluk "${prop.taluk}", SRO "${prop.sro}"`);

  let invalidSurveys = 0;
  let prohibitedLand = false;

  surveys.forEach((s, idx) => {
    const sNo = s.surveyNo || '';
    const key = `${s.surveyNo}/${s.subDivision}`;

    // Survey format check
    if (sNo && !/^\d+/.test(sNo)) {
      invalidSurveys++;
      alerts.push({
        message: `Land Record Anomaly: Survey No "${sNo}" is invalid. STAR 2.0 registers survey numbers starting with numbers.`,
        severity: 'critical',
        fix: 'Go to Step 4 and modify Survey No format (e.g., 142/3A or 142).'
      });
    }

    // Check Prohibited Surveys
    if (key === '142/3A' || key === '89/1B') {
      prohibitedLand = true;
      alerts.push({
        message: `Section 22-A Prohibited Land: Survey "${key}" in village "${prop.village}" matches STAR 2.0 active blocklists.`,
        severity: 'critical',
        fix: 'This plot is government-prohibited or under active court injunction. You must select an alternate survey division.'
      });
    }

    // Patta number numeric check
    if (s.pattaNo && !/^\d+$/.test(s.pattaNo.trim())) {
      alerts.push({
        message: `Patta Format Warning: Patta No "${s.pattaNo}" for Plot #${idx + 1} contains non-numeric characters.`,
        severity: 'moderate',
        fix: 'Verify the physical Patta book and enter the numeric reference number only.'
      });
    }
  });

  // TSLR for residential properties
  if (prop.propertyType?.toLowerCase().includes('residential') || prop.propertyType?.toLowerCase().includes('building')) {
    const hasTSLR = surveys.some(s => s.tslrNo?.trim());
    if (!hasTSLR) {
      alerts.push({
        message: 'TSLR Anomaly: Town Survey Land Record (TSLR) references are missing for urban/residential classification.',
        severity: 'moderate',
        fix: 'Go to Step 4 and input the TSLR Number under the survey plot segment.'
      });
    }
  }

  let status: 'Verified' | 'Partially Verified' | 'Unverified' | 'Suspicious' = 'Verified';
  if (prohibitedLand || invalidSurveys > 0) status = 'Suspicious';
  else if (surveys.length === 0) status = 'Unverified';
  else if (alerts.length > 0) status = 'Partially Verified';

  return {
    status,
    passed: status === 'Verified' || status === 'Partially Verified',
    details,
    alerts
  };
}

/**
 * OWNERSHIP CHAIN VERIFICATION ENGINE
 */
export function verifyOwnershipChain(state: DeedWizardState): VerificationModuleResult<'Verified' | 'Partially Verified' | 'Unverified' | 'Suspicious'> {
  const details: string[] = [];
  const alerts: VerificationModuleResult['alerts'] = [];

  const history = state.ownershipHistory || {};
  const docType = state.documentType || 'Sale Deed';

  // Power of Attorney or secondary deeds don't strictly require parent logs in the same manner, but Sale Deed absolutely does
  if (docType === 'Sale Deed' || docType === 'Settlement Deed' || docType === 'Gift Deed') {
    if (!history.parentDocNo?.trim() || !history.parentDocYear?.trim() || !history.parentDocSRO?.trim()) {
      alerts.push({
        message: 'Broken Ownership Continuity: Missing parent acquisition deed reference numbers.',
        severity: 'high',
        fix: 'Navigate to Step 7 and specify parent Deed Document Number, Year, and original SRO registrar office.'
      });
      return { status: 'Unverified', passed: false, details: ['Missing parent deed references'], alerts };
    }
  }

  details.push(`Parent deed registered as Doc #${history.parentDocNo}/${history.parentDocYear} SRO ${history.parentDocSRO}`);

  // Transfer chronology check
  if (history.parentDocDate) {
    const parentDate = new Date(history.parentDocDate);
    const today = new Date();
    
    if (parentDate > today) {
      alerts.push({
        message: `Chronological Paradox: Parent Deed registered on future date (${history.parentDocDate}).`,
        severity: 'critical',
        fix: 'Go to Step 7 and correct the Parent Deed Registration Date.'
      });
    } else {
      details.push(`Chronological chronology matches standard registry rules.`);
    }

    // Speculative rapid resale (under 2 years)
    const yearDiff = today.getFullYear() - parentDate.getFullYear();
    if (yearDiff >= 0 && yearDiff <= 2) {
      alerts.push({
        message: `Rapid Resale Speculation: Property was acquired extremely recently (${yearDiff} years ago). Highly indicative of title flipping or washing.`,
        severity: 'high',
        fix: 'Run a thorough 30-year online Encumbrance Certificate (EC) review to confirm no competing private leases.'
      });
    }
  }

  // Broken title check (seller matching previous owner)
  const sellers = state.parties.filter(p => p.role === 'Seller' || p.role === 'Donor');
  const priorOwnersText = (history.priorOwners || '').toLowerCase();
  
  if (sellers.length > 0 && priorOwnersText) {
    const sellerNames = sellers.map(s => s.name.trim().toLowerCase());
    const isMatched = sellerNames.some(name => priorOwnersText.includes(name) || name.split(' ').some(part => part.length > 3 && priorOwnersText.includes(part)));
    if (!isMatched) {
      alerts.push({
        message: 'Continuity Alert: Active Seller/Donor names are not cited in the prior registered ownership registry logs.',
        severity: 'high',
        fix: 'Verify prior owner text in Step 7 or review if the current seller received the title via an unrecorded inheritance.'
      });
    } else {
      details.push('Seller name matches continuous historic registers.');
    }
  }

  // Missing link deed check
  if (!history.historyNarrative?.trim() || history.historyNarrative.split(' ').length < 10) {
    alerts.push({
      message: 'Deed narrative history is too brief. SRO auditors require thorough description of lineage.',
      severity: 'moderate',
      fix: 'Expand the property ownership narrative in Step 7 to describe parent-to-child or buyer-to-seller lineage.'
    });
  }

  let status: 'Verified' | 'Partially Verified' | 'Unverified' | 'Suspicious' = 'Verified';
  if (alerts.some(a => a.severity === 'critical')) status = 'Suspicious';
  else if (alerts.some(a => a.severity === 'high')) status = 'Partially Verified';

  return {
    status,
    passed: status === 'Verified' || status === 'Partially Verified',
    details,
    alerts
  };
}

/**
 * FINANCIAL VERIFICATION ENGINE
 */
export function verifyFinancials(state: DeedWizardState): VerificationModuleResult<'Verified' | 'Partially Verified' | 'Unverified' | 'Suspicious'> {
  const details: string[] = [];
  const alerts: VerificationModuleResult['alerts'] = [];

  const tx = state.transaction || {};
  const docType = state.documentType || 'Sale Deed';

  const cons = tx.considerationAmount || 0;
  const guide = tx.guidelineValue || 0;

  if (docType === 'Sale Deed') {
    if (cons <= 0) {
      alerts.push({
        message: 'Illegal Sale Price: Absolute property sale deeds require a declared non-zero transaction value.',
        severity: 'critical',
        fix: 'Go to Step 8 and register the total purchase consideration amount agreed between parties.'
      });
      return { status: 'Unverified', passed: false, details: ['Zero sale consideration'], alerts };
    }

    if (guide <= 0) {
      alerts.push({
        message: 'Missing Guideline Valuation: SRO standard guideline value is missing or uncalculated.',
        severity: 'high',
        fix: 'Input the official TNreginet guideline value for the property plot in Step 8.'
      });
    }

    // Undervaluation checking
    if (cons > 0 && guide > 0) {
      if (cons < guide) {
        const dropPercent = Math.round((1 - cons / guide) * 100);
        alerts.push({
          message: `Statutory Undervaluation: Declared price (Rs. ${cons.toLocaleString()}) is lower than government guidelines (Rs. ${guide.toLocaleString()}) by ${dropPercent}%. This triggers instant Section 47-A impounding.`,
          severity: dropPercent >= 30 ? 'critical' : 'high',
          fix: 'Adjust the sale consideration in Step 8 to be equal or greater than the guideline value.'
        });
      } else {
        details.push(`Transaction pricing aligned with SRO guideline value.`);
      }
    }

    // Stamp duty check (7% in TN)
    const taxableBase = Math.max(cons, guide);
    if (taxableBase > 0) {
      const expectedStampDuty = Math.round(taxableBase * 0.07);
      const actualStampDuty = tx.stampDuty || 0;

      if (actualStampDuty < expectedStampDuty) {
        alerts.push({
          message: `Insufficient Stamp Duty: Declared Rs. ${actualStampDuty.toLocaleString()}, but TN rules mandate 7% (Rs. ${expectedStampDuty.toLocaleString()}).`,
          severity: 'high',
          fix: 'Go to Step 8 and adjust the stamp duty allocation to 7% of the maximum taxable value.'
        });
      } else {
        details.push('Stamp duty allocation fully compliant.');
      }

      // Registration fee check (4% in TN)
      const expectedRegFee = Math.round(taxableBase * 0.04);
      const actualRegFee = tx.registrationFee || 0;

      if (actualRegFee < expectedRegFee) {
        alerts.push({
          message: `Insufficient Registration Fees: Declared Rs. ${actualRegFee.toLocaleString()}, but TN rules mandate 4% (Rs. ${expectedRegFee.toLocaleString()}).`,
          severity: 'high',
          fix: 'Correct the registration fee input on Step 8.'
        });
      } else {
        details.push('Registration fees fully compliant.');
      }
    }
  } else if (docType === 'Gift Deed') {
    if (cons > 0) {
      alerts.push({
        message: 'Illegal Gift Consideration: Gift Deeds cannot involve monetary consideration under Section 122 of Transfer of Property Act.',
        severity: 'critical',
        fix: 'Go to Step 8 and set the consideration amount strictly to 0.'
      });
    }
  }

  // Advance + Balance sum
  if (cons > 0) {
    const adv = tx.advancePaid || 0;
    const bal = tx.balancePaid || 0;
    if (adv + bal !== cons) {
      alerts.push({
        message: `Payment Sum Mismatch: Advance (Rs. ${adv.toLocaleString()}) + Balance (Rs. ${bal.toLocaleString()}) does not equal Sale price (Rs. ${cons.toLocaleString()}).`,
        severity: 'critical',
        fix: 'Go to Step 8 and balance the payment schedule ledger.'
      });
    }
  }

  let status: 'Verified' | 'Partially Verified' | 'Unverified' | 'Suspicious' = 'Verified';
  if (alerts.some(a => a.severity === 'critical')) status = 'Suspicious';
  else if (alerts.some(a => a.severity === 'high')) status = 'Partially Verified';

  return {
    status,
    passed: status === 'Verified' || status === 'Partially Verified',
    details,
    alerts
  };
}

/**
 * FRAUD SIGNAL ENGINE
 */
export function detectFraudSignals(state: DeedWizardState): VerificationModuleResult<'Verified' | 'Partially Verified' | 'Unverified' | 'Suspicious'> {
  const details: string[] = [];
  const alerts: VerificationModuleResult['alerts'] = [];

  const parties = state.parties || [];
  const surveys = state.surveys || (state.survey ? [state.survey] : []);
  const history = state.ownershipHistory || {};
  const prop = state.property || {};

  let criticalSignals = 0;
  let highSignals = 0;

  // 1. Same property or prohibited register survey
  surveys.forEach((s) => {
    const key = `${s.surveyNo}/${s.subDivision}`;
    if (key === '142/3A' || key === '89/1B') {
      criticalSignals++;
      alerts.push({
        message: `Prohibited Section 22-A Plot: Plot coordinates ${key} are locked on active state-level fraud blocklists.`,
        severity: 'critical',
        fix: 'Substitute the survey division coordinates with verified commercial holdings.'
      });
    }
  });

  // 2. Duplicate phone channels between opposing roles
  parties.forEach((p1, idx1) => {
    parties.forEach((p2, idx2) => {
      if (idx1 < idx2 && p1.role !== p2.role) {
        if (p1.phone && p2.phone && p1.phone.trim() === p2.phone.trim()) {
          highSignals++;
          alerts.push({
            message: `Collusive Phone Duplication: Opposing parties "${p1.name}" and "${p2.name}" share phone "${p1.phone}". Highly indicative of proxy dummy dealings or collusive fraud.`,
            severity: 'high',
            fix: 'Go to Step 2 and update unique contact coordinates for both parties.'
          });
        }
      }
    });
  });

  // 3. Repeating / Placeholder identity patterns
  parties.forEach((p) => {
    const cleanAadhaar = (p.aadhaar || '').replace(/-/g, '');
    if (cleanAadhaar && /^1111|^1234|^9999|^0000/.test(cleanAadhaar)) {
      criticalSignals++;
      alerts.push({
        message: `Forged Identity Sequence: Aadhaar ID for "${p.name}" uses repeating placeholder tokens.`,
        severity: 'critical',
        fix: 'Replace the invalid Aadhaar pattern in Step 2 with the true masked client ID.'
      });
    }
  });

  // 4. Broken transfer timeline (parent document older than today but extremely close or after)
  if (history.parentDocDate) {
    const parentDate = new Date(history.parentDocDate);
    const today = new Date();
    const diffTime = today.getTime() - parentDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      criticalSignals++;
      alerts.push({
        message: 'Invalid Parent Timeline: Parent deed acquisition date is situated in the future.',
        severity: 'critical',
        fix: 'Correct parent document timeline dates in Step 7.'
      });
    } else if (diffDays < 30) {
      highSignals++;
      alerts.push({
        message: `Rapid flipping risk: Parent deed is under 30 days old (${diffDays} days). Massive alert for title double-leasing.`,
        severity: 'high',
        fix: 'Obtain certified wet-signature copies of SRO registers before proceeding.'
      });
    }
  }

  let status: 'Verified' | 'Partially Verified' | 'Unverified' | 'Suspicious' = 'Verified';
  if (criticalSignals > 0) status = 'Suspicious';
  else if (highSignals > 0) status = 'Partially Verified';

  return {
    status,
    passed: criticalSignals === 0,
    details,
    alerts
  };
}

/**
 * TRUST SCORING ENGINE
 */
export function calculateTrustScore(state: DeedWizardState): ComprehensiveVerificationResult {
  // Execute all modular service engines
  const identityResult = verifyIdentity(state);
  const propertyResult = verifyProperty(state);
  const ownershipResult = verifyOwnershipChain(state);
  const financialResult = verifyFinancials(state);
  const fraudResult = detectFraudSignals(state);

  // Compute points
  let idPoints = 25;
  let propPoints = 25;
  let ownPoints = 20;
  let finPoints = 15;
  let fraudPoints = 15;

  // Identity deductions
  identityResult.alerts.forEach((a) => {
    if (a.severity === 'critical') idPoints -= 12.5;
    else if (a.severity === 'high') idPoints -= 5;
    else idPoints -= 2;
  });
  idPoints = Math.max(0, idPoints);

  // Property deductions
  propertyResult.alerts.forEach((a) => {
    if (a.severity === 'critical') propPoints -= 12.5;
    else if (a.severity === 'high') propPoints -= 5;
    else propPoints -= 2;
  });
  propPoints = Math.max(0, propPoints);

  // Ownership deductions
  ownershipResult.alerts.forEach((a) => {
    if (a.severity === 'critical') ownPoints -= 10;
    else if (a.severity === 'high') ownPoints -= 5;
    else ownPoints -= 2;
  });
  ownPoints = Math.max(0, ownPoints);

  // Financial deductions
  financialResult.alerts.forEach((a) => {
    if (a.severity === 'critical') finPoints -= 7.5;
    else if (a.severity === 'high') finPoints -= 3.5;
    else finPoints -= 1.5;
  });
  finPoints = Math.max(0, finPoints);

  // Fraud deductions
  fraudResult.alerts.forEach((a) => {
    if (a.severity === 'critical') fraudPoints -= 7.5;
    else if (a.severity === 'high') fraudPoints -= 4;
    else fraudPoints -= 1.5;
  });
  fraudPoints = Math.max(0, fraudPoints);

  // Sum total score
  const rawTrustScore = Math.round(idPoints + propPoints + ownPoints + finPoints + fraudPoints);
  const trustScore = Math.min(100, Math.max(0, rawTrustScore));

  // Categorize bands
  let trustBand: ComprehensiveVerificationResult['trustBand'] = 'Trusted';
  if (trustScore <= 40) trustBand = 'High Risk';
  else if (trustScore <= 60) trustBand = 'Suspicious';
  else if (trustScore <= 80) trustBand = 'Review Recommended';

  return {
    identityResult,
    propertyResult,
    ownershipResult,
    financialResult,
    fraudResult,
    trustScore,
    trustBand,
    scoreBreakdown: {
      identity: Math.round(idPoints * 10) / 10,
      property: Math.round(propPoints * 10) / 10,
      ownership: Math.round(ownPoints * 10) / 10,
      financial: Math.round(finPoints * 10) / 10,
      fraud: Math.round(fraudPoints * 10) / 10
    }
  };
}
