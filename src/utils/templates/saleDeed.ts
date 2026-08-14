import { DeedWizardState } from '../../types';
import { formatParties, formatWitnesses } from '../partyFormatter';
import { generatePropertySchedule } from '../propertyScheduleGenerator';
import { formatIndianCurrency, numberToIndianWords } from '../amountFormatter';
import { generateClausesSection } from '../clauseInjectionEngine';

export function generateSaleDeed(state: DeedWizardState) {
  const sellersFormatted = formatParties(state.parties.filter(p => p.role === 'Seller'), 'Seller');
  const buyersFormatted = formatParties(state.parties.filter(p => p.role === 'Buyer'), 'Buyer');
  const scheduleFormatted = generatePropertySchedule(
    state.property,
    state.survey,
    state.surveys,
    state.extent,
    state.boundary
  );
  const clausesFormatted = generateClausesSection(state.selectedClauses, state);
  const witnessesFormatted = formatWitnesses(state.witnesses);

  const marketValStr = formatIndianCurrency(state.transaction.marketValue);
  const marketValWords = numberToIndianWords(state.transaction.marketValue);
  
  const considerationStr = formatIndianCurrency(state.transaction.considerationAmount);
  const considerationWords = numberToIndianWords(state.transaction.considerationAmount);

  const advancePaidStr = formatIndianCurrency(state.transaction.advancePaid || 0);
  const advancePaidWords = numberToIndianWords(state.transaction.advancePaid || 0);

  const balancePaidStr = formatIndianCurrency(state.transaction.balancePaid || 0);
  const balancePaidWords = numberToIndianWords(state.transaction.balancePaid || 0);

  const dateStr = state.transaction.paymentDate || '2026-06-29';
  const parsedDate = new Date(dateStr);
  const formattedEnglishDate = parsedDate.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
  
  return [
    {
      id: 'title',
      titleEn: 'Deed Title',
      titleTa: 'பத்திரத் தலைப்பு',
      contentEn: '<h2 class="text-center font-bold underline text-slate-900 text-sm">DEED OF ABSOLUTE SALE</h2>',
      contentTa: '<h2 class="text-center font-bold underline text-slate-900 text-sm">சுத்த கிரயப் பத்திரம்</h2>'
    },
    {
      id: 'intro',
      titleEn: 'Introductory Declaration',
      titleTa: 'அறிமுகப் பிரகடனம்',
      contentEn: `This DEED OF ABSOLUTE SALE is executed at <strong>${state.property.sro || 'Chennai'}</strong> on this <strong>${formattedEnglishDate}</strong>.`,
      contentTa: `இந்த சுத்த கிரயப் பத்திரம் <strong>${state.property.sro || 'சென்னை'}</strong> சார்பதிவக எல்லைக்குள் <strong>${formattedEnglishDate}</strong> அன்று எழுதப்பட்டது.`
    },
    {
      id: 'parties',
      titleEn: 'Description of Parties',
      titleTa: 'தரப்பினர் விவரம்',
      contentEn: `
        <div class="space-y-2">
          <p><strong>BY AND BETWEEN:</strong></p>
          <p>${sellersFormatted.en}</p>
          <p class="font-bold py-1">AND</p>
          <p>${buyersFormatted.en}</p>
        </div>
      `,
      contentTa: `
        <div class="space-y-2">
          <p><strong>எழுதிக் கொடுத்தவர் மற்றும் எழுதிக் வாங்கியவர்:</strong></p>
          <p>${sellersFormatted.ta}</p>
          <p class="font-bold py-1">மற்றும்</p>
          <p>${buyersFormatted.ta}</p>
        </div>
      `
    },
    {
      id: 'recitals',
      titleEn: 'Recitals & Background History',
      titleTa: 'சொத்து வரலாறு & முந்தைய விவரம்',
      contentEn: `
        <div class="space-y-2">
          <p><strong>WHEREAS:</strong></p>
          <p>1. The VENDOR is the absolute, lawful, and sole owner of the scheduled property described herein, having acquired the same through registered <strong>${state.ownershipHistory.parentDocType || 'Sale Deed'}</strong> bearing Document No. <strong>${state.ownershipHistory.parentDocNo || '————'}</strong> of year <strong>${state.ownershipHistory.parentDocYear || '————'}</strong>, registered at <strong>${state.ownershipHistory.parentDocSRO || 'SRO Mylapore'}</strong>, dated <strong>${state.ownershipHistory.parentDocDate || '————'}</strong>.</p>
          <p>2. Prior ownership trace belongs to the previous owner, namely <strong>${state.ownershipHistory.priorOwners || '————'}</strong>, who held a registered deed dated <strong>${state.ownershipHistory.parentDocDate || '————'}</strong> and registered at <strong>${state.ownershipHistory.parentDocSRO || '————'}</strong> under previous deed/document number <strong>${state.ownershipHistory.parentDocNo || '————'}</strong>, establishing a continuous, clear, and unbroken chain of title for a minimum period of 30 years.</p>
          <p>3. ${state.ownershipHistory.historyNarrative || 'The Vendor holds complete, peaceable, undisturbed, and uninterrupted possession of the Schedule Property since the date of acquisition, with clean marketable title free from any clouds.'}</p>
        </div>
      `,
      contentTa: `
        <div class="space-y-2">
          <p><strong>சொத்து வரலாறு விவரம்:</strong></p>
          <p>1. இக்கிரயப் பத்திரத்தில் விவரிக்கப்பட்டுள்ள சொத்தானது விற்பனையாளருக்கு முழுமையான மற்றும் தடையற்ற பூர்வீக/சுயார்ஜித சொத்தாகும். இச்சொத்து விற்பனையாளருக்கு <strong>${state.ownershipHistory.parentDocDate || '————'}</strong> தேதியிட்ட <strong>${state.ownershipHistory.parentDocType || 'கிரயப் பத்திரம்'}</strong>, ஆவண எண் <strong>${state.ownershipHistory.parentDocNo || '————'} / ${state.ownershipHistory.parentDocYear || '————'}</strong> ஆக <strong>${state.ownershipHistory.parentDocSRO || '————'}</strong> சார்பதிவகத்தில் பதிவாகி வாங்கியதாகும்.</p>
          <p>2. இச்சொத்தின் முந்தைய உரிமையாளர் <strong>${state.ownershipHistory.priorOwners || '————'}</strong> ஆவார். இச்சொத்தானது முந்தைய உரிமையாளரால் சார்பதிவாளர் அலுவலகம் <strong>${state.ownershipHistory.parentDocSRO || '————'}</strong>-ல் <strong>${state.ownershipHistory.parentDocDate || '————'}</strong> தேதியிட்ட முந்தைய ஆவண எண் <strong>${state.ownershipHistory.parentDocNo || '————'}</strong>-ன்படி பதிவு செய்யப்பட்டு பெறப்பட்டதாகும். இதன் மூலம் கடந்த 30 வருடங்களுக்கும் மேலாக இச்சொத்திற்கு தடையற்ற மற்றும் தொடர்ச்சியான உரிமைச் சங்கிலி (Chain of Title) நிறுவப்பட்டுள்ளது.</p>
          <p>3. ${state.ownershipHistory.historyNarrative || 'விற்பனையாளர் இச்சொத்தை வாங்கிய நாள் முதல் இன்று வரை எவ்வித வில்லங்கமுமின்றி அமைதியான சுவாதீன அனுபவத்தில் சகல உரிமைகளுடன் அனுபவித்து வருகிறார்.'}</p>
        </div>
      `
    },
    {
      id: 'transaction',
      titleEn: 'Transaction Terms & Consideration',
      titleTa: 'பரிவர்த்தனை மற்றும் கிரயத் தொகை',
      contentEn: `
        <div class="space-y-2">
          <p>NOW THIS DEED WITNESSETH that in pursuance of the agreement of sale, the VENDOR hereby transfers, conveys, and assigns all rights, title, interest, and claim of whatsoever nature in the scheduled property to the PURCHASER for an absolute consideration of <strong>${considerationStr}</strong> (${considerationWords}).</p>
          <p>The payment particulars are as follows:</p>
          <ul class="list-disc pl-5">
            <li>Advance Amount paid: <strong>${advancePaidStr}</strong> (${advancePaidWords})</li>
            <li>Balance Consideration paid: <strong>${balancePaidStr}</strong> (${balancePaidWords})</li>
            <li>Mode of payment: <strong>${state.transaction.paymentMode || 'RTGS/NEFT'}</strong></li>
            <li>Transaction Reference / Instrument No: <strong>${state.transaction.paymentRefNo || '————'}</strong></li>
            <li>Dated: <strong>${state.transaction.paymentDate || '————'}</strong> through <strong>${state.transaction.bankName || '————'}</strong></li>
          </ul>
        </div>
      `,
      contentTa: `
        <div class="space-y-2">
          <p>மேற்கண்ட ஒப்பந்தத்தின்படி விற்பனையாளர் இச்சொத்தின் மீதான தங்களின் சகல உரிமைகள், பாத்தியங்கள் மற்றும் அதிகாரங்களை வாங்குபவருக்கு முற்றிலும் மாற்றி எழுதிக் கொடுக்க சம்மதித்து, அதற்கான கிரயத் தொகையான <strong>${considerationStr}</strong> (${considerationWords}) ஐ முழுமையாக பெற்றுக் கொண்டுள்ளார்.</p>
          <p>பணம் செலுத்திய விவரங்கள் பின்வருமாறு:</p>
          <ul class="list-disc pl-5">
            <li>முன்பணமாக செலுத்தப்பட்ட தொகை: <strong>${advancePaidStr}</strong> (${advancePaidWords})</li>
            <li>மீதமுள்ள கிரயத் தொகை: <strong>${balancePaidStr}</strong> (${balancePaidWords})</li>
            <li>பணம் செலுத்திய முறை: <strong>${state.transaction.paymentMode || 'RTGS/NEFT'}</strong></li>
            <li>பரிவர்த்தனை குறிப்பு எண்: <strong>${state.transaction.paymentRefNo || '————'}</strong></li>
            <li>தேதி: <strong>${state.transaction.paymentDate || '————'}</strong>, வங்கி: <strong>${state.transaction.bankName || '————'}</strong></li>
          </ul>
        </div>
      `
    },
    {
      id: 'tax_encumbrance',
      titleEn: 'Tax & Registration Compliance',
      titleTa: 'வரி மற்றும் பதிவு இணக்கம்',
      contentEn: `
        <div class="space-y-2">
          <p><strong>REGISTRY COMPLIANCE AND TAX DECLARATIONS:</strong></p>
          <ul class="list-disc pl-5 text-slate-700 leading-relaxed">
            <li><strong>Encumbrance Certificate (EC) Ref:</strong> <strong>${state.transaction.ecReference || '————'}</strong> dated <strong>${state.transaction.ecDate || '————'}</strong>, covering a period of 30 years confirming the property is free from all encumbrances.</li>
            <li><strong>Property Tax Receipt Ref:</strong> <strong>${state.transaction.propertyTaxReceipt || '————'}</strong> confirming all local municipal and state tax dues are fully paid.</li>
            <li><strong>Stamp Duty Paid:</strong> <strong>${formatIndianCurrency(state.transaction.stampDuty || 0)}</strong> (${numberToIndianWords(state.transaction.stampDuty || 0)}) via STAR e-Stamping receipt.</li>
            <li><strong>Registration Fees Paid:</strong> <strong>${formatIndianCurrency(state.transaction.registrationFee || 0)}</strong> (${numberToIndianWords(state.transaction.registrationFee || 0)}) in full compliance with the TN Registration Department rules.</li>
          </ul>
        </div>
      `,
      contentTa: `
        <div class="space-y-2">
          <p><strong>வில்லங்கச் சான்று மற்றும் வரி விவரப் பிரகடனங்கள்:</strong></p>
          <ul class="list-disc pl-5 text-slate-700 leading-relaxed">
            <li><strong>வில்லங்கச் சான்றிதழ் (EC) குறிப்பு எண்:</strong> <strong>${state.transaction.ecReference || '————'}</strong>, தேதி: <strong>${state.transaction.ecDate || '————'}</strong> (30 வருட காலத்திற்குரிய வில்லங்கமற்ற சான்று சரிபார்க்கப்பட்டது).</li>
            <li><strong>சொத்து வரி ரசீது குறிப்பு:</strong> <strong>${state.transaction.propertyTaxReceipt || '————'}</strong> (நகராட்சி மற்றும் இதர உள்ளாட்சி வரிகள் அனைத்தும் முழுமையாக செலுத்தப்பட்டுள்ளது).</li>
            <li><strong>செலுத்தப்பட்ட முத்திரைத்தாள் கட்டணம்:</strong> <strong>${formatIndianCurrency(state.transaction.stampDuty || 0)}</strong> (${numberToIndianWords(state.transaction.stampDuty || 0)}) (STAR மின்னணு முத்திரைத்தாள் ரசீது).</li>
            <li><strong>செலுத்தப்பட்ட பதிவுக் கட்டணம்:</strong> <strong>${formatIndianCurrency(state.transaction.registrationFee || 0)}</strong> (${numberToIndianWords(state.transaction.registrationFee || 0)}) (தமிழ்நாடு பதிவுத்துறை விதிகளின்படி).</li>
          </ul>
        </div>
      `
    },
    {
      id: 'clauses',
      titleEn: 'Covenants & Clauses',
      titleTa: 'உடன்படிக்கைகள் மற்றும் நிபந்தனைகள்',
      contentEn: `
        <div class="space-y-2">
          <p><strong>THE VENDOR AND PURCHASER HEREBY COVENANT AS FOLLOWS:</strong></p>
          ${clausesFormatted.en}
        </div>
      `,
      contentTa: `
        <div class="space-y-2">
          <p><strong>தரப்பினரின் உடன்படிக்கைகள் பின்வருமாறு:</strong></p>
          ${clausesFormatted.ta}
        </div>
      `
    },
    {
      id: 'schedule',
      titleEn: 'Property Schedule Description',
      titleTa: 'சொத்து அட்டவணை விவரம்',
      contentEn: scheduleFormatted.en,
      contentTa: scheduleFormatted.ta
    },
    {
      id: 'witnesses',
      titleEn: 'Witness Attestation Section',
      titleTa: 'சாட்சிகள் உறுதிப்பகுதி',
      contentEn: `
        <div class="space-y-2">
          <p>IN WITNESS WHEREOF, the VENDOR and the PURCHASER have signed, sealed, and delivered this Deed of Absolute Sale on the day, month, and year first above written in the presence of the following witnesses:</p>
          <div class="mt-4 border-l-2 border-slate-300 pl-4">
            ${witnessesFormatted.en}
          </div>
        </div>
      `,
      contentTa: `
        <div class="space-y-2">
          <p>இதற்குச் சாட்சியாக, விற்பனையாளரும் வாங்குபவரும் தங்களின் முழு சம்மதத்துடன் இக்கிரயப் பத்திரத்தில் மேற்கண்ட தேதியில் கீழ் குறிப்பிட்ட சாட்சிகளின் முன்னிலையில் கையொப்பமிட்டுள்ளனர்:</p>
          <div class="mt-4 border-l-2 border-slate-300 pl-4">
            ${witnessesFormatted.ta}
          </div>
        </div>
      `
    },
    {
      id: 'signatures',
      titleEn: 'Signatures and Seals Block',
      titleTa: 'கையொப்பங்கள் மற்றும் முத்திரைப் பகுதி',
      contentEn: `
        <div class="grid grid-cols-2 gap-8 pt-6 font-mono text-xs">
          <div class="border-t border-slate-300 pt-3">
            <p className="font-bold">VENDOR (SELLER)</p>
            <p className="text-slate-500 mt-8">Name: ${sellersFormatted.collectiveEn}</p>
          </div>
          <div class="border-t border-slate-300 pt-3">
            <p className="font-bold">VENDEE (PURCHASER)</p>
            <p className="text-slate-500 mt-8">Name: ${buyersFormatted.collectiveEn}</p>
          </div>
        </div>
      `,
      contentTa: `
        <div class="grid grid-cols-2 gap-8 pt-6 font-mono text-xs">
          <div class="border-t border-slate-300 pt-3">
            <p className="font-bold">எழுதிக் கொடுத்தவர் (விற்பனையாளர்)</p>
            <p className="text-slate-500 mt-8">பெயர்: ${sellersFormatted.collectiveTa}</p>
          </div>
          <div class="border-t border-slate-300 pt-3">
            <p className="font-bold">எழுதி வாங்கிக் கொண்டவர் (வாங்குபவர்)</p>
            <p className="text-slate-500 mt-8">பெயர்: ${buyersFormatted.collectiveTa}</p>
          </div>
        </div>
      `
    }
  ];
}
