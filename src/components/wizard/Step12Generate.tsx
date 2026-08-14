import { useState, useRef, useEffect } from 'react';
import { 
  CheckCircle, 
  ShieldCheck, 
  Download, 
  Printer, 
  Copy, 
  FileText, 
  Lock, 
  Unlock, 
  RotateCcw, 
  AlertTriangle, 
  Eye, 
  EyeOff, 
  Check, 
  Award,
  History,
  Clock,
  UserCheck
} from 'lucide-react';
import { DeedWizardState, DraftStatus, SavedDraft } from '../../types';
import { useApp } from '../../context/AppContext';
import { compileDeedDocument } from '../../utils/documentGenerator';
import { formatIndianCurrency, numberToIndianWords } from '../../utils/amountFormatter';
import { QRCodeSVG, BarcodeSVG } from '../../utils/qrBarcodeGenerator';
import { runAiValidation } from '../../utils/aiValidator';
import { calculateTrustScore } from '../../utils/verificationService';
import LegalPrintEngine from '../LegalPrintEngine';

interface Step12GenerateProps {
  state: DeedWizardState;
}

export default function Step12Generate({ state }: Step12GenerateProps) {
  const { 
    currentDraft, 
    updateDraftStatus, 
    savedDrafts, 
    updateCurrentDraftState, 
    calculateProgress 
  } = useApp();

  const [showFinalPreview, setShowFinalPreview] = useState<boolean>(true);
  const [includeDigitalSeals, setIncludeDigitalSeals] = useState<boolean>(true);
  const [includeLawyerSign, setIncludeLawyerSign] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const paginatedContainerRef = useRef<HTMLDivElement>(null);

  // Generate deterministic secure token for SRO verification
  const token = currentDraft 
    ? `STAR-2.0-TN-${currentDraft.docNo.replace(/[^0-9]/g, '') || '1042099'}`
    : `STAR-2.0-TN-1042099`;

  const docNo = currentDraft?.docNo || 'DEED/2026/0142';
  const progress = currentDraft ? calculateProgress(state) : 0;
  const isComplete = progress >= 90; // Allowed if major fields completed
  const docStatus = currentDraft?.status || 'Draft';
  const isLocked = docStatus === 'Finalized' || docStatus === 'Exported' || docStatus === 'Archived';

  // Compile deed content
  const compiledDeed = compileDeedDocument(state, docNo);

  const copyTokenToClipboard = () => {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 10 & 11. Final Document Locking & Versioning Controller
  const handleFinalizeDocument = () => {
    if (!currentDraft) return;
    if (!isComplete) {
      setExportError("Compliance block: Cannot finalize document. Mandatory details must be 100% completed first.");
      return;
    }

    // AI Validation Gate Integration
    const validation = runAiValidation(state);
    const criticals = validation.warnings.filter(w => w.severity === 'error');
    const warningsList = validation.warnings.filter(w => w.severity === 'warning');

    if (criticals.length > 0) {
      const errorMsg = `AI Compliance Block: "${criticals[0].message}" (Step ${criticals[0].step}, ${criticals[0].field}). Please correct all Critical errors before final STAR 2.0 generation.`;
      setExportError(errorMsg);
      alert(`Finalization BLOCKED by AI Validation Engine!\n\nThere are ${criticals.length} Critical legal/compliance errors. You must resolve them before final STAR 2.0 generation.`);
      return;
    }

    if (warningsList.length > 0) {
      const firstWarnMsg = warningsList[0].message;
      const confirmOverride = window.confirm(
        `AI Validation Warning Override:\n\nThere are ${warningsList.length} compliance warnings detected (e.g., "${firstWarnMsg}").\n\nWould you like to override these warnings and finalize anyway?`
      );
      if (!confirmOverride) {
        setExportError("Finalization cancelled by user to correct compliance warnings.");
        return;
      }
    }

    // Trust Engine Verification Gate
    const trustResult = calculateTrustScore(state);
    if (trustResult.trustBand === 'High Risk') {
      const errorMsg = `Trust Verification Gate Blocked: Trust Score is ${trustResult.trustScore} (${trustResult.trustBand}). This deed fails crucial anti-fraud or statutory validation rules. Finalization is strictly BLOCKED.`;
      setExportError(errorMsg);
      alert(`Finalization BLOCKED by Trust Engine!\n\nYour deed has a trust rating of "${trustResult.trustBand}" with a score of ${trustResult.trustScore}/100.\n\nAll High Risk issues must be corrected before finalization.`);
      return;
    }

    if (trustResult.trustBand === 'Suspicious') {
      const confirmManual = window.confirm(
        `Trust Engine Alert: This deed is flagged as SUSPICIOUS (Trust Score: ${trustResult.trustScore}/100).\n\nUnder STAR 2.0 regulations, suspicious documents require an intensive Manual Review and manual override.\n\nDo you want to proceed and certify that you have manually reviewed all identity and title chain anomalies?`
      );
      if (!confirmManual) {
        setExportError("Finalization cancelled for manual compliance review.");
        return;
      }
    }

    setExportError(null);
    updateDraftStatus(currentDraft.id, 'Finalized');
    alert(`Document ${docNo} has been legally FINALISED and entered into an IMMUTABLE state under Tamil Nadu STAR 2.0 guidelines.`);
  };

  const handleCreateNewRevision = () => {
    if (!currentDraft) return;
    
    const confirmRev = window.confirm(
      "You are about to edit a locked, finalized document. Under legal protocols, this will create a new version revision (e.g., -v2), archive the current version, and reset status to 'Draft' for editing. Do you wish to proceed?"
    );
    if (!confirmRev) return;

    try {
      const currentDocNo = currentDraft.docNo;
      let baseDocNo = currentDocNo;
      let newVer = 2;

      // Extract base and current version suffix
      const vMatch = currentDocNo.match(/(.+)-v(\d+)$/);
      if (vMatch) {
        baseDocNo = vMatch[1];
        newVer = parseInt(vMatch[2], 10) + 1;
      } else {
        newVer = 2;
      }

      const newDocNo = `${baseDocNo}-v${newVer}`;
      const currentVerNum = currentDraft.version || 1;

      // Save previous revision in history logs
      const revisionLog = {
        docNo: currentDocNo,
        status: currentDraft.status,
        modifiedAt: new Date().toISOString(),
        version: currentVerNum
      };

      const updatedHistory = [
        ...(currentDraft.revisionHistory || []),
        revisionLog
      ];

      // Update active draft status to draft, increment version, append docNo suffix
      const updatedState = { ...state };
      
      const updatedDraft: SavedDraft = {
        ...currentDraft,
        docNo: newDocNo,
        status: 'Draft',
        version: newVer,
        revisionHistory: updatedHistory,
        modifiedAt: new Date().toISOString(),
        state: updatedState
      };

      // Directly update draft state in AppContext
      updateCurrentDraftState(updatedState);
      updateDraftStatus(currentDraft.id, 'Draft');
      
      // Patch local docNo directly via AppContext manual action
      currentDraft.docNo = newDocNo;
      currentDraft.version = newVer;
      currentDraft.revisionHistory = updatedHistory;

      alert(`Successfully spawned a new revision: ${newDocNo}. The document is now unlocked for compliant editing.`);
    } catch (err) {
      setExportError("Failed to initiate a new revision. Please check system configuration.");
    }
  };

  // 1 & 13. Export DOCX format with standard Word compatibility
  const handleExportDOCX = () => {
    if (!currentDraft) return;
    if (!isLocked) {
      setExportError("Compliance block: Legal documents must be 'Finalized' before standard DOCX generation.");
      return;
    }
    setExportError(null);

    try {
      const content = paginatedContainerRef.current?.innerHTML || '';
      const htmlString = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" 
              xmlns:w="urn:schemas-microsoft-com:office:word" 
              xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="utf-8">
          <title>Legal Deed - ${docNo}</title>
          <style>
            @page {
              size: A4;
              margin: 25mm 25mm 25mm 25mm;
            }
            body {
              font-family: 'Times New Roman', serif;
              font-size: 12pt;
              line-height: 1.5;
              text-align: justify;
            }
            .page-break {
              page-break-after: always;
            }
            .stamp-paper {
              border: 3px double #15803d;
              padding: 15px;
              text-align: center;
              margin-bottom: 25px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 15px 0;
            }
            th, td {
              border: 1px solid #94a3b8;
              padding: 8px;
              font-size: 10pt;
              vertical-align: top;
            }
            .bilingual-grid {
              display: table;
              width: 100%;
              table-layout: fixed;
            }
            .bilingual-col {
              display: table-cell;
              width: 50%;
              padding: 10px;
            }
          </style>
        </head>
        <body>
          ${content}
        </body>
        </html>
      `;

      const blob = new Blob(['\ufeff' + htmlString], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${docNo.replace(/[^a-zA-Z0-9]/g, '_')}_final_deed.doc`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Transition to Exported Status
      updateDraftStatus(currentDraft.id, 'Exported');
    } catch (err) {
      setExportError("DOCX generation error: Could not compile template markers.");
    }
  };

  // 1 & 2. PDF & Print triggers native high-fidelity print stylesheet with browser PDF converter
  const handlePrintOrPDF = () => {
    if (!currentDraft) return;
    if (!isLocked) {
      setExportError("Compliance block: Legal deeds must be 'Finalized' before print-ready distribution.");
      return;
    }
    setExportError(null);

    try {
      const printContents = paginatedContainerRef.current?.innerHTML || '';
      const originalContents = document.body.innerHTML;
      
      // Create a temporary iframe or trigger direct print
      const printWindow = window.open('', '_blank', 'width=950,height=800');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>${docNo} - STAR 2.0 TN Official Deed</title>
              <style>
                @import url('https://fonts.googleapis.com/css2?family=Mukta+Malar:wght@400;700&display=swap');
                @page {
                  size: A4 portrait;
                  margin: 0;
                }
                body {
                  margin: 0;
                  padding: 0;
                  background-color: #ffffff;
                  color: #000000;
                  font-family: 'Times New Roman', Times, serif;
                  font-size: 11pt;
                  line-height: 1.5;
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
                .a4-page {
                  width: 210mm;
                  height: 296mm;
                  box-sizing: border-box;
                  padding: 20mm 18mm 20mm 18mm;
                  page-break-after: always;
                  position: relative;
                  display: flex;
                  flex-direction: col;
                  justify-content: space-between;
                }
                .text-justify {
                  text-align: justify;
                }
                .tamil-text {
                  font-family: 'Mukta Malar', sans-serif;
                  font-size: 9.5pt;
                  line-height: 1.5;
                }
                .bilingual-grid {
                  display: grid;
                  grid-template-columns: 1fr 1fr;
                  gap: 25px;
                }
                .stamp-border {
                  border: 5px double #15803d !important;
                  padding: 15px;
                  background-color: #f0fdf4 !important;
                  text-align: center;
                  margin-bottom: 25px;
                }
                .header-meta {
                  border-bottom: 1px solid #cbd5e1;
                  padding-bottom: 8px;
                  margin-bottom: 20px;
                  font-family: monospace;
                  font-size: 8pt;
                  display: flex;
                  justify-content: space-between;
                  color: #475569;
                }
                .footer-meta {
                  border-top: 1px solid #cbd5e1;
                  padding-top: 8px;
                  font-family: monospace;
                  font-size: 8pt;
                  display: flex;
                  justify-content: space-between;
                  color: #475569;
                  position: absolute;
                  bottom: 20mm;
                  left: 18mm;
                  right: 18mm;
                }
                .photo-block {
                  width: 70px;
                  height: 85px;
                  border: 1px solid #94a3b8;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 7pt;
                  background: #f8fafc;
                  text-align: center;
                  color: #64748b;
                }
                .thumb-block {
                  width: 70px;
                  height: 50px;
                  border: 1px dashed #94a3b8;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 7pt;
                  background: #f8fafc;
                  text-align: center;
                  color: #64748b;
                }
                .sig-box {
                  border-top: 1px solid #000;
                  margin-top: 35px;
                  padding-top: 5px;
                  font-size: 8.5pt;
                }
                .compliance-badge {
                  border: 1.5px solid #10b981;
                  padding: 4px 8px;
                  background: #f0fdf4;
                  font-size: 7.5pt;
                  font-weight: bold;
                  color: #047857;
                  border-radius: 4px;
                }
                .table-bordered {
                  width: 100%;
                  border-collapse: collapse;
                }
                .table-bordered td, .table-bordered th {
                  border: 1px solid #94a3b8;
                  padding: 6px;
                  font-size: 8.5pt;
                }
                @media print {
                  body { background: #fff; }
                  .no-print { display: none; }
                }
              </style>
            </head>
            <body onload="window.print(); window.close();">
              ${printContents}
            </body>
          </html>
        `);
        printWindow.document.close();
        updateDraftStatus(currentDraft.id, 'Exported');
      }
    } catch (err) {
      setExportError("Print pipeline error: Pagination calculation interrupted.");
    }
  };

  // Extract variables for compliance QR Code
  const sellerObj = state.parties.find(p => p.role === 'Seller' || p.role === 'Donor');
  const buyerObj = state.parties.find(p => p.role === 'Buyer' || p.role === 'Donee');
  const sellerName = sellerObj?.name || '————';
  const buyerName = buyerObj?.name || '————';
  const surveyNo = state.survey?.surveyNo || '————';
  const SRO = state.property?.sro || '————';
  const execDate = state.transaction?.paymentDate || '2026-06-29';

  // Secure Verification URI
  const verificationURL = `${window.location.origin}/verify/${docNo.replace(/\//g, '_')}`;

  const qrPayload = `DocID: ${docNo}\nVendor: ${sellerName}\nPurchaser: ${buyerName}\nSurvey: ${surveyNo}\nSRO: ${SRO}\nDate: ${execDate}\nToken: ${token}\nVerify: ${verificationURL}`;

  return (
    <div className="p-6 text-left space-y-6 text-slate-800 font-sans" id="step-12-generate-panel">
      
      {/* 13. Error Panel */}
      {exportError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-xs text-rose-800 animate-shake">
          <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-extrabold uppercase tracking-tight">Compliance Error Blocked Pipeline</p>
            <p className="mt-1 font-medium text-rose-700">{exportError}</p>
          </div>
        </div>
      )}

      <LegalPrintEngine
        state={state}
        currentDraft={currentDraft}
        onFinalize={handleFinalizeDocument}
        onNewRevision={handleCreateNewRevision}
        isLocked={isLocked}
      />

    </div>
  );
}
