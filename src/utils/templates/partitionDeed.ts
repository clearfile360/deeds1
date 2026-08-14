import { DeedWizardState } from '../../types';
import { formatParties, formatWitnesses } from '../partyFormatter';
import { generatePropertySchedule } from '../propertyScheduleGenerator';
import { formatIndianCurrency, numberToIndianWords } from '../amountFormatter';
import { generateClausesSection } from '../clauseInjectionEngine';

export function generatePartitionDeed(state: DeedWizardState) {
  const party1 = state.parties.filter(p => p.role === 'Donor' || p.role === 'Seller' || p.id === 'p1');
  const party2 = state.parties.filter(p => p.role === 'Donee' || p.role === 'Buyer' || p.id === 'p2');

  const party1Formatted = formatParties(party1, 'Seller'); // map to first co-owner
  const party2Formatted = formatParties(party2, 'Buyer'); // map to second co-owner
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
      contentEn: '<h2 class="text-center font-bold underline text-slate-900 text-sm">DEED OF PARTITION</h2>',
      contentTa: '<h2 class="text-center font-bold underline text-slate-900 text-sm">பாகப்பிரிவினை பத்திரம்</h2>'
    },
    {
      id: 'intro',
      titleEn: 'Introductory Declaration',
      titleTa: 'அறிமுகப் பிரகடனம்',
      contentEn: `This DEED OF PARTITION is executed at <strong>${state.property.sro || 'Chennai'}</strong> on this <strong>${formattedEnglishDate}</strong>.`,
      contentTa: `இந்த பாகப்பிரிவினை பத்திரம் <strong>${state.property.sro || 'சென்னை'}</strong> சார்பதிவக எல்லைக்குள் <strong>${formattedEnglishDate}</strong> அன்று எழுதப்பட்டது.`
    },
    {
      id: 'parties',
      titleEn: 'Description of Parties',
      titleTa: 'தரப்பினர் விவரம்',
      contentEn: `
        <div class="space-y-2">
          <p><strong>BY AND BETWEEN:</strong></p>
          <p>${party1Formatted.en} (hereinafter referred to as the <strong>FIRST CO-OWNER</strong>)</p>
          <p class="font-bold py-1">AND</p>
          <p>${party2Formatted.en} (hereinafter referred to as the <strong>SECOND CO-OWNER</strong>)</p>
        </div>
      `,
      contentTa: `
        <div class="space-y-2">
          <p><strong>பாகஸ்தர்கள் விவரம்:</strong></p>
          <p>${party1Formatted.ta} (இனிமேல் "<strong>முதல் பாகஸ்தர்</strong>" என்று அழைக்கப்படுபவர்)</p>
          <p class="font-bold py-1">மற்றும்</p>
          <p>${party2Formatted.ta} (இனிமேல் "<strong>இரண்டாம் பாகஸ்தர்</strong>" என்று அழைக்கப்படுபவர்)</p>
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
          <p>1. The CO-OWNERS are jointly seised and possessed of or otherwise well and sufficiently entitled to the Scheduled Property described hereunder, having purchased/acquired it jointly or through inheritance from <strong>${state.ownershipHistory.priorOwners || '————'}</strong>.</p>
          <p>2. The title trace relates to registered Doc No. <strong>${state.ownershipHistory.parentDocNo || '————'}</strong> of year <strong>${state.ownershipHistory.parentDocYear || '————'}</strong>, at SRO <strong>${state.ownershipHistory.parentDocSRO || '————'}</strong>.</p>
          <p>3. To avoid future disputes and differences, the Co-owners have mutually agreed to divide and partition the joint scheduled property so that each party shall hold their partitioned share as independent, absolute owner hereafter.</p>
        </div>
      `,
      contentTa: `
        <div class="space-y-2">
          <p><strong>சொத்து வரலாறு விவரம்:</strong></p>
          <p>1. இப்பாகப்பிரிவினை பத்திரத்தில் விவரிக்கப்பட்டுள்ள சொத்தானது பாகஸ்தர்களுக்கு முந்தைய கூட்டு உரிமையாகவோ அல்லது பூர்வீகமாக <strong>${state.ownershipHistory.priorOwners || '————'}</strong> என்பவரிடமிருந்து வாரிசுரிமை மூலமாகவோ கிடைத்ததாகும்.</p>
          <p>2. இச்சொத்து முந்தைய ஆவண எண் <strong>${state.ownershipHistory.parentDocNo || '————'} / ${state.ownershipHistory.parentDocYear || '————'}</strong> ஆக <strong>${state.ownershipHistory.parentDocSRO || '————'}</strong> சார்பதிவகத்தில் பதிவாகி அனுபவித்து வந்ததாகும்.</p>
          <p>3. பாகஸ்தர்கள் தங்களுக்குள் எதிர்காலத்தில் எவ்வித கருத்து வேறுபாடுகளும் ஏற்படாமல் இருக்கவும், சொத்தை தனித்தனியாக அனுபவிக்கவும் தங்களுக்குரிய பாகங்களாகப் பிரித்துக் கொள்ள சம்மதித்துள்ளனர்.</p>
        </div>
      `
    },
    {
      id: 'transaction',
      titleEn: 'Transaction Terms & Valuation',
      titleTa: 'பரிவர்த்தனை மற்றும் பாகமதிப்பு',
      contentEn: `
        <div class="space-y-2">
          <p>NOW THIS DEED WITNESSETH that the joint scheduled property is divided into SCHEDULE 'A' allocation for the FIRST CO-OWNER and SCHEDULE 'B' allocation for the SECOND CO-OWNER.</p>
          <p>The total value of the properties partitioned under this deed is evaluated at <strong>${marketValStr}</strong> (${marketValWords}) for stamp duty calculations, and the parties declare that no cash adjustment or owelty was paid.</p>
        </div>
      `,
      contentTa: `
        <div class="space-y-2">
          <p>இதன்படி, கூட்டுச் சொத்துக்களானது பிரிக்கப்பட்டு, முதல் பாகஸ்தருக்கு ஒதுக்கப்பட்ட பகுதி மற்றும் இரண்டாம் பாகஸ்தருக்கு ஒதுக்கப்பட்ட பகுதி என தனித்தனியாக பிரிக்கப்பட்டு சுவாதீனம் ஒப்படைக்கப்படுகிறது.</p>
          <p>இப்பாகப்பிரிவினை பத்திரப் பதிவிற்காக சொத்துக்களின் மொத்த மதிப்பு <strong>${marketValStr}</strong> (${marketValWords}) என மதிப்பிடப்பட்டுள்ளது. பாகங்கள் சமமாக பிரிக்கப்பட்டுள்ளதால் இதர ஈட்டுத் தொகைகள் எதுவும் கைமாறவில்லை.</p>
        </div>
      `
    },
    {
      id: 'clauses',
      titleEn: 'Covenants & Clauses',
      titleTa: 'உடன்படிக்கைகள் மற்றும் நிபந்தனைகள்',
      contentEn: `
        <div class="space-y-2">
          <p><strong>THE CO-OWNERS MUTUALLY COVENANT AS FOLLOWS:</strong></p>
          ${clausesFormatted.en}
        </div>
      `,
      contentTa: `
        <div class="space-y-2">
          <p><strong>பாகஸ்தர்களின் உடன்படிக்கைகள் பின்வருமாறு:</strong></p>
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
          <p>IN WITNESS WHEREOF, the FIRST CO-OWNER and the SECOND CO-OWNER have signed, sealed, and delivered this Partition Deed in the presence of the following witnesses:</p>
          <div class="mt-4 border-l-2 border-slate-300 pl-4">
            ${witnessesFormatted.en}
          </div>
        </div>
      `,
      contentTa: `
        <div class="space-y-2">
          <p>இதற்குச் சாட்சியாக, பாகஸ்தர்கள் தங்களின் முழு சம்மதத்துடன் இப்பாகப்பிரிவினை பத்திரத்தில் கீழ் குறிப்பிட்ட சாட்சிகளின் முன்னிலையில் கையொப்பமிட்டுள்ளனர்:</p>
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
            <p className="font-bold">FIRST CO-OWNER</p>
            <p className="text-slate-500 mt-8">Name: ${party1Formatted.collectiveEn}</p>
          </div>
          <div class="border-t border-slate-300 pt-3">
            <p className="font-bold">SECOND CO-OWNER</p>
            <p className="text-slate-500 mt-8">Name: ${party2Formatted.collectiveEn}</p>
          </div>
        </div>
      `,
      contentTa: `
        <div class="grid grid-cols-2 gap-8 pt-6 font-mono text-xs">
          <div class="border-t border-slate-300 pt-3">
            <p className="font-bold">முதல் பாகஸ்தர்</p>
            <p className="text-slate-500 mt-8">பெயர்: ${party1Formatted.collectiveTa}</p>
          </div>
          <div class="border-t border-slate-300 pt-3">
            <p className="font-bold">இரண்டாம் பாகஸ்தர்</p>
            <p className="text-slate-500 mt-8">பெயர்: ${party2Formatted.collectiveTa}</p>
          </div>
        </div>
      `
    }
  ];
}
