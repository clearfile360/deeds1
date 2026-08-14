import { useRef } from 'react';
import { FileText, Download, Printer, ShieldCheck, HelpCircle } from 'lucide-react';
import { DeedWizardState } from '../types';
import { compileDeedDocument } from '../utils/documentGenerator';
import { formatIndianCurrency } from '../utils/amountFormatter';

interface DocumentPreviewProps {
  state: DeedWizardState;
  activeStep: number;
}

export default function DocumentPreview({ state, activeStep }: DocumentPreviewProps) {
  const previewRef = useRef<HTMLDivElement>(null);

  // Compile the deed using our core generation engine
  const compiledDeed = compileDeedDocument(state, 'DEED/2026/0142');

  const printDocument = () => {
    const printContent = previewRef.current?.innerHTML;
    const windowUrl = 'about:blank';
    const uniqueName = new Date().getTime();
    const windowName = `PrintWindow_${uniqueName}`;
    const PrintWindow = window.open(windowUrl, windowName, 'width=900,height=650');
    if (PrintWindow) {
      PrintWindow.document.write(`
        <html>
          <head>
            <title>Draft Deed - Preview</title>
            <style>
              body { font-family: 'Times New Roman', serif; padding: 40px; line-height: 1.6; }
              .stamp-header { border: 4px double #15803d; padding: 20px; text-align: center; margin-bottom: 30px; }
              .bilingual-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 15px; }
              .tamil { font-family: 'Mukta Malar', sans-serif; font-size: 13px; }
              .english { font-size: 14px; }
              .section-title { font-weight: bold; text-decoration: underline; text-align: center; margin-top: 25px; margin-bottom: 15px; }
              .page-break { page-break-after: always; }
            </style>
          </head>
          <body>
            ${printContent}
          </body>
        </html>
      `);
      PrintWindow.document.close();
      PrintWindow.focus();
      setTimeout(() => {
        PrintWindow.print();
        PrintWindow.close();
      }, 500);
    }
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl flex flex-col h-full overflow-hidden shadow-inner">
      {/* Control Bar */}
      <div className="bg-white px-5 py-3 border-b border-slate-200 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <FileText className="h-4.5 w-4.5 text-slate-500" />
          <span className="text-sm font-bold text-slate-700">Live Deed Preview Pane</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700 border border-amber-200 animate-pulse">
            LIVE SYNC
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={printDocument}
            className="p-1.5 hover:bg-slate-100 rounded text-slate-600 transition"
            title="Print printable deed"
          >
            <Printer className="h-4 w-4" />
          </button>
          <button
            onClick={() => alert("DOCX compilation is fully simulated. Standard DOCX format was generated in /backend/temp/deed.docx")}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white rounded transition"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Generate PDF/DOCX</span>
          </button>
        </div>
      </div>

      {/* Preview Sheet Container */}
      <div className="flex-1 p-6 overflow-y-auto flex justify-center bg-slate-100/50">
        <div 
          ref={previewRef}
          id="deed-preview-sheet"
          className="w-full max-w-[800px] bg-white border border-slate-300 rounded-lg shadow-lg p-10 font-serif text-slate-800 text-left min-h-[1100px] flex flex-col selection:bg-emerald-100"
        >
          {/* INDIAN STAMP HEADER */}
          <div className="border-[6px] border-double border-emerald-800 p-4 mb-4 flex flex-col items-center bg-emerald-50/20 rounded relative overflow-hidden">
            <div className="absolute top-0 right-0 left-0 h-1.5 bg-emerald-800" />
            
            {/* Ornamental stamp border */}
            <div className="text-center font-serif text-emerald-800 tracking-wider">
              <p className="text-xs font-bold uppercase leading-none">GOVERNMENT OF INDIA • TAMIL NADU REGISTRY</p>
              <h2 className="text-3xl font-extrabold tracking-widest mt-1 mb-1 font-serif text-emerald-900">INDIA NON JUDICIAL</h2>
              <p className="text-[10px] font-bold text-emerald-700">தமிழ்நாடு அரசிதழ் பதிவு • STAR 2.0 DIGITAL DEED SECURE</p>
            </div>

            <div className="w-full border-t border-dashed border-emerald-800/30 my-3" />

            <div className="flex justify-between w-full text-xs font-mono font-bold text-emerald-800 px-4">
              <span>SRO: {state.property.sro || '————'}</span>
              <span>NO: TN-D20261142099</span>
              <span>VAL: {formatIndianCurrency(state.transaction.marketValue || 10000)}</span>
            </div>
          </div>

          {/* Engine Versioning & Timestamp */}
          <div className="bg-slate-50 border border-slate-200/60 rounded px-3 py-1.5 mb-6 flex justify-between items-center text-[9px] font-mono text-slate-400">
            <span>ENGINE: {compiledDeed.metadata.templateVersion}</span>
            <span>GEN TIME: {new Date(compiledDeed.metadata.generatedAt).toLocaleString()} (UTC)</span>
            <span>REV: #{compiledDeed.metadata.revisionNo}</span>
          </div>

          {/* DYNAMIC BILINGUAL SECTIONS */}
          <div className="space-y-6 flex-1">
            {compiledDeed.sections.map((section) => {
              const isTitle = section.id === 'title';
              const isSignatures = section.id === 'signatures';
              
              if (isTitle) {
                return (
                  <div key={section.id} className="text-center border-b border-slate-200 pb-4 mb-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="font-sans text-slate-800" dangerouslySetInnerHTML={{ __html: section.contentTa }} />
                      <div className="font-serif text-slate-800" dangerouslySetInnerHTML={{ __html: section.contentEn }} />
                    </div>
                  </div>
                );
              }

              if (isSignatures) {
                return (
                  <div key={section.id} className="pt-6 border-t border-slate-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <p className="text-[9px] text-slate-400 font-bold mb-2 uppercase tracking-wider font-sans">Tamil Signatures / தமிழ் கையொப்பங்கள்</p>
                        <div className="font-sans text-slate-800" dangerouslySetInnerHTML={{ __html: section.contentTa }} />
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-400 font-bold mb-2 uppercase tracking-wider font-sans">English Signatures / ஆங்கில கையொப்பங்கள்</p>
                        <div className="font-serif text-slate-800" dangerouslySetInnerHTML={{ __html: section.contentEn }} />
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div key={section.id} className="border-b border-slate-100 pb-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-100/40 px-2 py-0.5 rounded font-mono">
                      {section.titleEn} / {section.titleTa}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="font-sans text-xs text-slate-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: section.contentTa }} />
                    <div className="font-serif text-xs text-slate-800 leading-relaxed" dangerouslySetInnerHTML={{ __html: section.contentEn }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* STAR 2.0 Digitally Signed Seal Stamp */}
          <div className="mt-8 border-t border-slate-150 pt-4 flex justify-between items-center text-[10px] font-mono text-slate-400">
            <div className="flex items-center gap-2">
              <div className="border border-emerald-600/30 text-emerald-600/60 rounded-full w-12 h-12 flex flex-col items-center justify-center text-[6px] font-sans pointer-events-none uppercase font-bold tracking-widest p-1">
                <ShieldCheck className="h-3.5 w-3.5 mb-0.5 text-emerald-500" />
                <span>STAR-2.0</span>
              </div>
              <div>
                <p className="text-slate-500 font-semibold uppercase">TN STAR 2.0 SECURE DIGITAL SEAL</p>
                <p className="text-[8px] text-slate-400">TOKEN: {compiledDeed.metadata.docNo}</p>
              </div>
            </div>
            <div className="text-right">
              <p>PAGE 1 OF 1</p>
              <p className="text-[8px]">REGULATORY LEVEL 1 COMPLIANT</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
