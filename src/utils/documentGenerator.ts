import { DeedWizardState } from '../types';
import { generateSaleDeed } from './templates/saleDeed';
import { generateSettlementDeed } from './templates/settlementDeed';
import { generateGiftDeed } from './templates/giftDeed';
import { generatePartitionDeed } from './templates/partitionDeed';
import { generateLeaseDeed } from './templates/leaseDeed';
import { generateMortgageDeed } from './templates/mortgageDeed';
import { generatePowerOfAttorney } from './templates/powerOfAttorney';

export interface LegalSection {
  id: string;
  titleEn: string;
  titleTa: string;
  contentEn: string;
  contentTa: string;
}

export interface GeneratedDeed {
  metadata: {
    templateVersion: string;
    generatedAt: string;
    revisionNo: number;
    docNo: string;
  };
  sections: LegalSection[];
}

/**
 * Main compilation entry point for the Legal Document Generation Engine.
 * Supports Sale, Settlement, Gift, Partition, Lease, Mortgage, and Power of Attorney deeds.
 */
export function compileDeedDocument(state: DeedWizardState, docNo: string = 'DEED/2026/0001'): GeneratedDeed {
  let sections: LegalSection[] = [];

  const docType = state.documentType?.toUpperCase() || 'SALE';

  switch (docType) {
    case 'SALE':
      sections = generateSaleDeed(state);
      break;
    case 'SETTLE':
      sections = generateSettlementDeed(state);
      break;
    case 'GIFT':
      sections = generateGiftDeed(state);
      break;
    case 'PARTITION':
      sections = generatePartitionDeed(state);
      break;
    case 'LEASE':
      sections = generateLeaseDeed(state);
      break;
    case 'MORTGAGE':
      sections = generateMortgageDeed(state);
      break;
    case 'POA':
    case 'POWER OF ATTORNEY':
      sections = generatePowerOfAttorney(state);
      break;
    default:
      sections = generateSaleDeed(state);
      break;
  }

  return {
    metadata: {
      templateVersion: 'v2.0.1-STAR2',
      generatedAt: new Date().toISOString(),
      revisionNo: 1,
      docNo
    },
    sections
  };
}
