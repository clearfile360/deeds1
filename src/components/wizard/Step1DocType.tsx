import { useState } from 'react';
import { Search, Check, ChevronDown } from 'lucide-react';

interface Step1DocTypeProps {
  documentType: string;
  onChange: (value: string) => void;
}

const DOCUMENT_TYPES = [
  { code: 'SALE', name: 'Sale Deed', ta: 'கிரயப் பத்திரம்' },
  { code: 'SETTLEMENT', name: 'Settlement Deed', ta: 'செட்டில்மெண்ட் பத்திரம்' },
  { code: 'GIFT', name: 'Gift Deed', ta: 'தான பத்திரம்' },
  { code: 'PARTITION', name: 'Partition Deed', ta: 'பாகப்பிரிவினை பத்திரம்' },
  { code: 'RELEASE', name: 'Release Deed', ta: 'விடுதலைப் பத்திரம்' },
  { code: 'LEASE', name: 'Lease Deed', ta: 'குத்தகை பத்திரம்' },
  { code: 'MORTGAGE', name: 'Mortgage Deed', ta: 'அடமானப் பத்திரம்' },
  { code: 'POA', name: 'Power of Attorney', ta: 'பொது அதிகாரப் பத்திரம்' },
  { code: 'RECTIFICATION', name: 'Rectification Deed', ta: 'பிழை திருத்தல் பத்திரம்' },
  { code: 'CANCELLATION', name: 'Cancellation Deed', ta: 'இரத்து பத்திரம்' },
  { code: 'TRUST', name: 'Trust Deed', ta: 'அறக்கட்டளை பத்திரம்' },
  { code: 'PARTNERSHIP', name: 'Partnership Deed', ta: 'கூட்டுத்தொழில் பத்திரம்' },
  { code: 'WILL', name: 'Will', ta: 'உயில் சாசனம்' }
];

export default function Step1DocType({ documentType, onChange }: Step1DocTypeProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const filteredTypes = DOCUMENT_TYPES.filter(dt =>
    dt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    dt.ta.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedDoc = DOCUMENT_TYPES.find(dt => dt.code === documentType) || DOCUMENT_TYPES[0];

  return (
    <div className="space-y-4" id="step-1-doc-type">
      <p className="text-xs text-slate-500 font-medium">
        Select the registration deed type. Choosing a type will pre-configure compliant legal templates. <span className="text-rose-500 font-bold">*</span>
      </p>

      <div className="relative">
        <label className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider block mb-1.5">
          Select Document Type <span className="text-rose-500">*</span>
        </label>
        
        {/* Custom searchable dropdown selector */}
        <div 
          onClick={() => setIsOpen(!isOpen)}
          className="w-full border border-slate-250 rounded-lg p-3 text-xs bg-white flex items-center justify-between cursor-pointer hover:border-slate-300 transition shadow-sm font-bold text-slate-800"
        >
          <div>
            <span>{selectedDoc.name}</span>
            <span className="text-slate-400 font-normal ml-2">({selectedDoc.ta})</span>
          </div>
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </div>

        {isOpen && (
          <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden max-h-64 flex flex-col">
            <div className="p-2 border-b border-slate-150 bg-slate-50 flex items-center gap-2 shrink-0">
              <Search className="h-4 w-4 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search document type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="w-full bg-transparent border-none text-xs focus:outline-none p-1 text-slate-700"
                autoFocus
              />
            </div>
            
            <div className="overflow-y-auto divide-y divide-slate-100">
              {filteredTypes.length > 0 ? (
                filteredTypes.map((dt) => {
                  const isSelected = dt.code === documentType;
                  return (
                    <div
                      key={dt.code}
                      onClick={() => {
                        onChange(dt.code);
                        setIsOpen(false);
                        setSearchQuery('');
                      }}
                      className={`p-3 text-xs flex items-center justify-between cursor-pointer hover:bg-slate-50 transition ${
                        isSelected ? 'bg-emerald-50 text-emerald-800 font-semibold' : 'text-slate-700'
                      }`}
                    >
                      <div>
                        <span className="font-bold">{dt.name}</span>
                        <span className="text-slate-400 ml-2 font-normal">({dt.ta})</span>
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-emerald-600 shrink-0" />}
                    </div>
                  );
                })
              ) : (
                <div className="p-4 text-xs text-slate-400 text-center">No document types match your search</div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-[11px] text-slate-600">
        <span className="font-extrabold text-slate-700 uppercase tracking-wider block mb-1">Rule Compliance Alert:</span>
        Chosen deed will trigger dynamic sub-registration validation under STAR 2.0. Standard stamp duty will apply based on this selection.
      </div>
    </div>
  );
}
