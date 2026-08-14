import { DeedWizardState } from '../../types';
import { formatParties, formatWitnesses } from '../partyFormatter';
import { generatePropertySchedule } from '../propertyScheduleGenerator';
import { formatIndianCurrency, numberToIndianWords } from '../amountFormatter';
import { generateClausesSection } from '../clauseInjectionEngine';

export function generateSettlementDeed(state: DeedWizardState) {
  // First party is Settlor, Second is Settlee
  const settlors = state.parties.filter(p => p.role === 'Donor' || p.role === 'Seller' || p.id === 'p1');
  const settlees = state.parties.filter(p => p.role === 'Donee' || p.role === 'Buyer' || p.id === 'p2');

  const settlorsFormatted = formatParties(settlors, 'Donor'); // donor maps to Settlor/Donor
  const settleesFormatted = formatParties(settlees, 'Donee'); // donee maps to Settlee/Donee
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
      contentEn: '<h2 class="text-center font-bold underline text-slate-900 text-sm">DEED OF FAMILY SETTLEMENT</h2>',
      contentTa: '<h2 class="text-center font-bold underline text-slate-900 text-sm">குடும்ப செட்டில்மெண்ட் பத்திரம்</h2>'
    },
    {
      id: 'intro',
      titleEn: 'Introductory Declaration',
      titleTa: 'அறிமுகப் பிரகடனம்',
      contentEn: `This DEED OF FAMILY SETTLEMENT is executed at <strong>${state.property.sro || 'Chennai'}</strong> on this <strong>${formattedEnglishDate}</strong>.`,
      contentTa: `இந்த குடும்ப செட்டில்மெண்ட் பத்திரம் <strong>${state.property.sro || 'சென்னை'}</strong> சார்பதிவக எல்லைக்குள் <strong>${formattedEnglishDate}</strong> அன்று எழுதப்பட்டது.`
    },
    {
      id: 'parties',
      titleEn: 'Description of Parties',
      titleTa: 'தரப்பினர் விவரம்',
      contentEn: `
        <div class="space-y-2">
          <p><strong>BY AND BETWEEN:</strong></p>
          <p>${settlorsFormatted.en} (hereinafter referred to as the <strong>SETTLOR</strong>)</p>
          <p class="font-bold py-1">AND</p>
          <p>${settleesFormatted.en} (hereinafter referred to as the <strong>SETTLEE</strong>)</p>
        </div>
      `,
      contentTa: `
        <div class="space-y-2">
          <p><strong>எழுதிக் கொடுத்தவர் மற்றும் எழுதி வாங்கிக் கொண்டவர்:</strong></p>
          <p>${settlorsFormatted.ta} (இனிமேல் "<strong>செட்டில்மெண்ட் செய்பவர்</strong>" என்று அழைக்கப்படுபவர்)</p>
          <p class="font-bold py-1">மற்றும்</p>
          <p>${settleesFormatted.ta} (இனிமேல் "<strong>செட்டில்மெண்ட் பெறுபவர்</strong>" என்று அழைக்கப்படுபவர்)</p>
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
          <p>1. The SETTLOR is the absolute owner and in vacant, peaceful possession of the scheduled property described in the schedule hereunder, having purchased/acquired the same through a <strong>${state.ownershipHistory.parentDocType || 'Sale Deed'}</strong> bearing Document No. <strong>${state.ownershipHistory.parentDocNo || '————'}</strong> of year <strong>${state.ownershipHistory.parentDocYear || '————'}</strong> at <strong>${state.ownershipHistory.parentDocSRO || 'SRO Mylapore'}</strong>.</p>
          <p>2. The Settlee is the close family relative (child/spouse) of the Settlor, and the Settlor out of natural love, affection and goodwill desires to settle the scheduled property absolutely in favor of the Settlee to secure their future welfare and livelihood.</p>
          <p>3. Prior owners of trace include <strong>${state.ownershipHistory.priorOwners || '————'}</strong>. ${state.ownershipHistory.historyNarrative || ''}</p>
        </div>
      `,
      contentTa: `
        <div class="space-y-2">
          <p><strong>சொத்து வரலாறு விவரம்:</strong></p>
          <p>1. இக்குடும்ப செட்டில்மெண்ட் பத்திரத்தில் விவரிக்கப்பட்டுள்ள சொத்தானது செட்டில்மெண்ட் செய்பவருக்கு முழுமையான மற்றும் தடையற்ற சொந்த சொத்தாகும். இச்சொத்து செட்டில்மெண்ட் செய்பவருக்கு <strong>${state.ownershipHistory.parentDocDate || '————'}</strong> தேதியிட்ட <strong>${state.ownershipHistory.parentDocType || 'கிரயப் பத்திரம்'}</strong>, ஆவண எண் <strong>${state.ownershipHistory.parentDocNo || '————'} / ${state.ownershipHistory.parentDocYear || '————'}</strong> ஆக <strong>${state.ownershipHistory.parentDocSRO || '————'}</strong> சார்பதிவகத்தில் பதிவானதாகும்.</p>
          <p>2. செட்டில்மெண்ட் பெறுபவர், செட்டில்மெண்ட் செய்பவரின் நெருங்கிய குடும்ப உறுப்பினர் (மகன்/மகள்/மனைவி) ஆவார். செட்டில்மெண்ட் செய்பவர் தன் மீது கொண்டுள்ள இயற்கை அன்பு, பாசம் மற்றும் எதிர்கால நல்வாழ்விற்காக இச்சொத்தை எவ்வித பிரதிபலனுமின்றி செட்டில்மெண்ட் செய்து கொடுக்க விரும்புகிறார்.</p>
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
          <p>NOW THIS DEED WITNESSETH that in consideration of natural love and affection, the SETTLOR hereby grants, conveys, transfers and assigns the Scheduled Property hereunder to the SETTLEE absolutely and forever.</p>
          <p>The Market Value of the Scheduled Property for the purpose of stamp duty and registration fee is estimated at <strong>${marketValStr}</strong> (${marketValWords}). No monetary consideration is exchanged for this settlement as it is done out of family love and affection.</p>
        </div>
      `,
      contentTa: `
        <div class="space-y-2">
          <p>மேற்கண்ட குடும்ப அன்பு மற்றும் பாசத்தின் அடிப்படையில், செட்டில்மெண்ட் செய்பவர் இச்சொத்தின் மீதான தங்களின் சகல உரிமைகளையும், அதிகாரங்களையும் செட்டில்மெண்ட் பெறுபவருக்கு முற்றிலும் இலவசமாகவும் தடையற்றதாகவும் மாற்றி எழுதிக் கொடுக்கிறார்.</p>
          <p>இப்பத்திரப் பதிவிற்காக சொத்தின் சந்தை மதிப்பு <strong>${marketValStr}</strong> (${marketValWords}) என மதிப்பிடப்பட்டுள்ளது. இது குடும்ப உறுப்பினர்களுக்குள் எழுதப்படும் பத்திரம் என்பதால் எவ்வித பணப் பரிவர்த்தனையும் நடைபெறவில்லை.</p>
        </div>
      `
    },
    {
      id: 'clauses',
      titleEn: 'Covenants & Clauses',
      titleTa: 'உடன்படிக்கைகள் மற்றும் நிபந்தனைகள்',
      contentEn: `
        <div class="space-y-2">
          <p><strong>THE SETTLOR AND SETTLEE HEREBY COVENANT AS FOLLOWS:</strong></p>
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
          <p>IN WITNESS WHEREOF, the SETTLOR has signed and delivered this Family Settlement Deed in the presence of the following witnesses:</p>
          <div class="mt-4 border-l-2 border-slate-300 pl-4">
            ${witnessesFormatted.en}
          </div>
        </div>
      `,
      contentTa: `
        <div class="space-y-2">
          <p>இதற்குச் சாட்சியாக, செட்டில்மெண்ட் செய்பவர் தன் முழு மனதுடன் இக்குடும்ப செட்டில்மெண்ட் பத்திரத்தில் கீழ் குறிப்பிட்ட சாட்சிகளின் முன்னிலையில் கையொப்பமிட்டுள்ளார்:</p>
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
            <p className="font-bold">SETTLOR (SETTLING PARTY)</p>
            <p className="text-slate-500 mt-8">Name: ${settlorsFormatted.collectiveEn}</p>
          </div>
          <div class="border-t border-slate-300 pt-3">
            <p className="font-bold">SETTLEE (RECEIVING PARTY)</p>
            <p className="text-slate-500 mt-8">Name: ${settleesFormatted.collectiveEn}</p>
          </div>
        </div>
      `,
      contentTa: `
        <div class="grid grid-cols-2 gap-8 pt-6 font-mono text-xs">
          <div class="border-t border-slate-300 pt-3">
            <p className="font-bold">செட்டில்மெண்ட் செய்பவர்</p>
            <p className="text-slate-500 mt-8">பெயர்: ${settlorsFormatted.collectiveTa}</p>
          </div>
          <div class="border-t border-slate-300 pt-3">
            <p className="font-bold">செட்டில்மெண்ட் பெறுபவர்</p>
            <p className="text-slate-500 mt-8">பெயர்: ${settleesFormatted.collectiveTa}</p>
          </div>
        </div>
      `
    }
  ];
}
