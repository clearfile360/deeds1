export type UserRole =
  | 'Super Admin'
  | 'Admin'
  | 'Document Writer'
  | 'Lawyer'
  | 'Broker'
  | 'Data Entry Operator'
  | 'Client'
  | 'Auditor';

export interface UserAccount {
  id: string;
  uid?: string;
  name: string;
  email: string;
  phone?: string;
  organization?: string;
  role: UserRole;
  permissions?: string[];
  status: 'Approved' | 'Pending Approval' | 'Suspended';
  createdAt: string;
  photo?: string;
}

export function getRoleAllowedTabs(role: UserRole): string[] {
  switch (role) {
    case 'Super Admin':
      return ['dashboard', 'ai-agents', 'documents', 'wizard', 'clients', 'templates', 'clauses', 'admin', 'settings'];
    case 'Admin':
      return ['dashboard', 'ai-agents', 'documents', 'wizard', 'clients', 'templates', 'clauses', 'admin', 'settings'];
    case 'Document Writer':
    case 'Lawyer':
      return ['dashboard', 'ai-agents', 'documents', 'wizard', 'clients', 'templates', 'clauses', 'settings'];
    case 'Broker':
      return ['dashboard', 'ai-agents', 'documents', 'clients'];
    case 'Client':
      return ['documents', 'ai-agents', 'clients', 'settings'];
    case 'Auditor':
      return ['dashboard', 'ai-agents', 'documents', 'admin', 'settings'];
    case 'Data Entry Operator':
      return ['dashboard', 'ai-agents', 'documents', 'wizard', 'clients'];
    default:
      return ['dashboard', 'ai-agents'];
  }
}

export interface Permission {
  id: string;
  name: string;
  description: string;
  rolesAllowed: UserRole[];
}

export interface ClientProfile {
  id: string;
  name: string;
  fatherName: string;
  dob: string;
  age: number;
  occupation: string;
  pan: string;
  aadhaar: string;
  address: string;
  phone: string;
  email: string;
  createdAt: string;
}

export interface MasterTableData {
  id: string;
  code: string;
  nameEn: string;
  nameTa: string;
  description?: string;
  extra?: Record<string, string | number>;
}

export interface MasterData {
  documentTypes: MasterTableData[];
  documentSubtypes: MasterTableData[];
  partyRoles: MasterTableData[];
  occupationMaster: MasterTableData[];
  relationshipMaster: MasterTableData[];
  districtMaster: MasterTableData[];
  registrationDistrictMaster: MasterTableData[];
  talukMaster: MasterTableData[];
  villageMaster: MasterTableData[];
  sroMaster: MasterTableData[];
  propertyTypeMaster: MasterTableData[];
  clauseLibrary?: Clause[];
}

export interface PartyDetails {
  id: string;
  role: 'Seller' | 'Buyer' | 'Donor' | 'Donee' | 'Power Agent' | 'Witness' | 'Other';
  name: string;
  fatherName: string;
  age: number;
  dob: string;
  occupation: string;
  aadhaar: string;
  pan: string;
  phone: string;
  mobile?: string;
  email: string;
  address: string;
  clientId?: string; // If auto-filled from client
}

export interface PropertyDetails {
  district: string;
  registrationDistrict: string;
  taluk: string;
  village: string;
  ward: string;
  block: string;
  propertyType: string;
  sro: string;
  doorNo?: string;
}

export interface SurveyDetails {
  id?: string;
  surveyNo: string;
  subDivision: string;
  pattaNo: string;
  tslrNo: string;
  chittaRef?: string;
}

export interface ExtentDetails {
  sqft: number;
  acre: number;
  cent: number;
  hectare: number;
  areaUnit?: 'Sq.ft' | 'Cent' | 'Acre' | 'Ground' | 'Sq.m' | 'Hectare';
  eastWest?: string;
  northSouth?: string;
  totalExtent?: number;
  builtUpArea?: number;
  uds?: number;
}

export interface BoundaryDetails {
  east: string;
  west: string;
  north: string;
  south: string;
}

export interface OwnershipHistory {
  parentDocType?: string;
  parentDocNo: string;
  parentDocYear: string;
  parentDocSRO: string;
  parentDocDate: string;
  priorOwners: string;
  historyNarrative: string;
}

export interface TransactionDetails {
  marketValue: number;
  guidelineValue: number;
  considerationAmount: number;
  advancePaid?: number;
  balancePaid?: number;
  paymentMode: 'Cash' | 'Cheque' | 'NEFT/RTGS' | 'DD' | 'UPI' | 'Bank Transfer' | 'RTGS' | 'Other';
  paymentRefNo: string;
  paymentDate: string;
  bankName: string;
  ecReference?: string;
  ecDate?: string;
  propertyTaxReceipt?: string;
  stampDuty?: number;
  registrationFee?: number;
}

export interface WitnessDetails {
  id: string;
  name: string;
  fatherName: string;
  age: number;
  aadhaar: string;
  address: string;
  phone: string;
  occupation?: string;
  idProof?: string;
}

export interface Clause {
  id: string;
  title: string;
  category: string;
  contentEn: string;
  contentTa: string;
  isActive: boolean;
  isMandatory: boolean;
}

export interface DeedWizardState {
  documentType: string; // e.g. Sale, Gift, etc.
  documentSubtype: string;
  parties: PartyDetails[];
  property: PropertyDetails;
  survey: SurveyDetails;
  surveys?: SurveyDetails[];
  extent: ExtentDetails;
  boundary: BoundaryDetails;
  ownershipHistory: OwnershipHistory;
  transaction: TransactionDetails;
  witnesses: WitnessDetails[];
  selectedClauses: string[]; // clause IDs
}

export type DraftStatus = 'Draft' | 'In Progress' | 'Pending Review' | 'Review' | 'Approved' | 'Finalized' | 'Exported' | 'Generated' | 'Archived';

export interface SavedDraft {
  id: string;
  docNo: string;
  docType: string;
  subType: string;
  partiesCount: number;
  propertyAddress: string;
  consideration: number;
  status: DraftStatus;
  writer: string;
  progress: number;
  createdAt: string;
  modifiedAt: string;
  createdBy: string;
  state: DeedWizardState;
  version?: number;
  revisionHistory?: { docNo: string; status: DraftStatus; modifiedAt: string; version: number }[];
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user?: string;
  userEmail?: string;
  role?: UserRole;
  action?: string;
  type?: string;
  message?: string;
  details?: string;
  ipAddress?: string;
  ip?: string;
  device?: string;
  browser?: string;
}

export interface SystemNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
  read: boolean;
}

export interface AIValidationResult {
  passed: boolean;
  warnings: {
    field: string;
    step: number;
    severity: 'error' | 'warning' | 'info';
    message: string;
    suggestion: string;
  }[];
  fraudScore: number; // 0 to 100
  fraudAlerts: string[];
}
