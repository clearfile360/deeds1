import { DeedWizardState } from '../../types';
import { formatParties, formatWitnesses } from '../partyFormatter';
import { generatePropertySchedule } from '../propertyScheduleGenerator';
import { formatIndianCurrency, numberToIndianWords } from '../amountFormatter';
import { generateClausesSection } from '../clauseInjectionEngine';

export function generateGiftDeed(state: DeedWizardState) {
  const donors = state.parties.filter(p => p.role === 'Donor' || p.role === 'Seller' || p.id === 'p1');
  const donees = state.parties.filter(p => p.role === 'Donee' || p.role === 'Buyer' || p.id === 'p2');

  const donorsFormatted = formatParties(donors, 'Donor');
  const doneesFormatted = formatParties(donees, 'Donee');
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
      contentEn: '<h2 class="text-center font-bold underline text-slate-900 text-sm">DEED OF GIFT SETTLEMENT</h2>',
      contentTa: '<h2 class="text-center font-bold underline text-slate-900 text-sm">தான செட்டில்மெண்ட் பத்திரம்</h2>'
    },
    {
      id: 'intro',
      titleEn: 'Introductory Declaration',
      titleTa: 'அறிமுகப் பிரகடனம்',
      contentEn: `This DEED OF GIFT SETTLEMENT is executed at <strong>${state.property.sro || 'Chennai'}</strong> on this <strong>${formattedEnglishDate}</strong>.`,
      contentTa: `இந்த தான செட்டில்மெண்ட் பத்திரம் <strong>${state.property.sro || 'சென்னை'}</strong> சார்பதிவக எல்லைக்குள் <strong>${formattedEnglishDate}</strong> அன்று எழுதப்பட்டது.`
    },
    {
      id: 'parties',
      titleEn: 'Description of Parties',
      titleTa: 'தரப்பினர் விவரம்',
      contentEn: `
        <div class="space-y-2">
          <p><strong>BY AND BETWEEN:</strong></p>
          <p>${donorsFormatted.en} (hereinafter referred to as the <strong>DONOR</strong>)</p>
          <p class="font-bold py-1">AND</p>
          <p>${doneesFormatted.en} (hereinafter referred to as the <strong>DONEE</strong>)</p>
        </div>
      `,
      contentTa: `
        <div class="space-y-2">
          <p><strong>எழுதிக் கொடுத்தவர் மற்றும் எழுதி வாங்கிக் கொண்டவர்:</strong></p>
          <p>${donorsFormatted.ta} (இனிமேல் "<strong>கொடையாளர்</strong>" என்று அழைக்கப்படுபவர்)</p>
          <p class="font-bold py-1">மற்றும்</p>
          <p>${doneesFormatted.ta} (இனிமேல் "<strong>கொடைபெறுபவர்</strong>" என்று அழைக்கப்படுபவர்)</p>
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
          <p>1. The DONOR is the sole owner and in absolute possession of the scheduled property described in the schedule hereunder, having purchased/acquired the same through a registered <strong>${state.ownershipHistory.parentDocType || 'Sale Deed'}</strong> bearing Document No. <strong>${state.ownershipHistory.parentDocNo || '————'}</strong> of year <strong>${state.ownershipHistory.parentDocYear || '————'}</strong> at <strong>${state.ownershipHistory.parentDocSRO || 'SRO Mylapore'}</strong>.</p>
          <p>2. The Donor, out of natural love, affection and without any force or monetary consideration, wishes to make an absolute gift of the Scheduled Property to the Donee, who has consented to accept the same.</p>
          <p>3. Prior owners include <strong>${state.ownershipHistory.priorOwners || '————'}</strong>. ${state.ownershipHistory.historyNarrative || ''}</p>
        </div>
      `,
      contentTa: `
        <div class="space-y-2">
          <p><strong>சொத்து வரலாறு விவரம்:</strong></p>
          <p>1. இத்தானப் பத்திரத்தில் விவரிக்கப்பட்டுள்ள சொத்தானது கொடையாளருக்கு முழுமையான மற்றும் தடையற்ற சொந்த சொத்தாகும். இச்சொத்து கொடையாளருக்கு <strong>${state.ownershipHistory.parentDocDate || '————'}</strong> தேதியிட்ட <strong>${state.ownershipHistory.parentDocType || 'கிரயப் பத்திரம்'}</strong>, ஆவண எண் <strong>${state.ownershipHistory.parentDocNo || '————'} / ${state.ownershipHistory.parentDocYear || '————'}</strong> ஆக <strong>${state.ownershipHistory.parentDocSRO || '————'}</strong> சார்பதிவகத்தில் பதிவானதாகும்.</p>
          <p>2. கொடையாளர் தன் மீது கொண்டுள்ள இயற்கை அன்பு, பாசத்தின் காரணமாகவும், எவ்வித வற்புறுத்தலோ அல்லது பணப் பரிமாற்றமோ இன்றி, இச்சொத்தை கொடைபெறுபவருக்கு பரிசாக வழங்க விரும்புகிறார், கொடைபெறுபவரும் இதனை முழு சம்மதத்துடன் ஏற்றுக்கொள்கிறார்.</p>
          <p>3. சொத்தின் முந்தைய உரிமையாளர்: <strong>${state.ownershipHistory.priorOwners || '————'}</strong>. ${state.ownershipHistory.historyNarrative || ''}</p>
        </div>
      `
    },
    {
      id: 'transaction',
      titleEn: 'Transaction Terms & Valuation',
      titleTa: 'பரிவர்த்தனை மற்றும் சொத்து மதிப்பு',
      contentEn: `
        <div class="space-y-2">
          <p>NOW THIS DEED WITNESSETH that the DONOR hereby grants, transfers and conveys by way of Gift all rights, title, interest and possession of the Scheduled Property to the DONEE forever.</p>
          <p>The Market Value of the Scheduled Property for the purpose of stamp duty and registration fee is estimated at <strong>${marketValStr}</strong> (${marketValWords}). No monetary consideration has been or shall be paid in respect of this Gift.</p>
        </div>
      `,
      contentTa: `
        <div class="space-y-2">
          <p>மேற்கண்ட இயற்கை அன்பு மற்றும் பாசத்தின் அடிப்படையில், கொடையாளர் இச்சொத்தின் மீதான தங்களின் சகல உரிமைகளையும், அதிகாரங்களையும் கொடைபெறுபவருக்கு பரிசாக முற்றிலும் இலவசமாகவும் தடையற்றதாகவும் மாற்றி எழுதி கொடுத்து, சுவாதீனத்தை ஒப்படைக்கிறார்.</p>
          <p>இப்பத்திரப் பதிவிற்காக சொத்தின் சந்தை மதிப்பு <strong>${marketValStr}</strong> (${marketValWords}) என மதிப்பிடப்பட்டுள்ளது. இது கொடைப் பத்திரம் என்பதால் எவ்வித பணப் பரிவர்த்தனையும் நடைபெறவில்லை.</p>
        </div>
      `
    },
    {
      id: 'clauses',
      titleEn: 'Covenants & Clauses',
      titleTa: 'உடன்படிக்கைகள் மற்றும் நிபந்தனைகள்',
      contentEn: `
        <div class="space-y-2">
          <p><strong>THE DONOR AND DONEE HEREBY COVENANT AS FOLLOWS:</strong></p>
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
          <p>IN WITNESS WHEREOF, the DONOR and the DONEE have signed and delivered this Gift Deed in the presence of the following witnesses:</p>
          <div class="mt-4 border-l-2 border-slate-300 pl-4">
            ${witnessesFormatted.en}
          </div>
        </div>
      `,
      contentTa: `
        <div class="space-y-2">
          <p>இதற்குச் சாட்சியாக, கொடையாளரும் கொடைபெறுபவரும் தங்களின் முழு சம்மதத்துடன் இத்தானப் பத்திரத்தில் கீழ் குறிப்பிட்ட சாட்சிகளின் முன்னிலையில் கையொப்பமிட்டுள்ளனர்:</p>
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
            <p className="font-bold">DONOR (GIFTING PARTY)</p>
            <p className="text-slate-500 mt-8">Name: ${donorsFormatted.collectiveEn}</p>
          </div>
          <div class="border-t border-slate-300 pt-3">
            <p className="font-bold">DONEE (RECEIVING PARTY)</p>
            <p className="text-slate-500 mt-8">Name: ${doneesFormatted.collectiveEn}</p>
          </div>
        </div>
      `,
      contentTa: `
        <div class="grid grid-cols-2 gap-8 pt-6 font-mono text-xs">
          <div class="border-t border-slate-300 pt-3">
            <p className="font-bold">கொடையாளர்</p>
            <p className="text-slate-500 mt-8">பெயர்: ${donorsFormatted.collectiveTa}</p>
          </div>
          <div class="border-t border-slate-300 pt-3">
            <p className="font-bold">கொடைபெறுபவர்</p>
            <p className="text-slate-500 mt-8">பெயர்: ${doneesFormatted.collectiveTa}</p>
          </div>
        </div>
      `
    }
  ];
}
