import { DeedWizardState } from '../../types';
import { formatParties, formatWitnesses } from '../partyFormatter';
import { generatePropertySchedule } from '../propertyScheduleGenerator';
import { formatIndianCurrency, numberToIndianWords } from '../amountFormatter';
import { generateClausesSection } from '../clauseInjectionEngine';

export function generateLeaseDeed(state: DeedWizardState) {
  const lessors = state.parties.filter(p => p.role === 'Donor' || p.role === 'Seller' || p.id === 'p1');
  const lessees = state.parties.filter(p => p.role === 'Donee' || p.role === 'Buyer' || p.id === 'p2');

  const lessorsFormatted = formatParties(lessors, 'Seller'); // map to Lessor
  const lesseesFormatted = formatParties(lessees, 'Buyer'); // map to Lessee
  const scheduleFormatted = generatePropertySchedule(
    state.property,
    state.survey,
    state.surveys,
    state.extent,
    state.boundary
  );
  const clausesFormatted = generateClausesSection(state.selectedClauses, state);
  const witnessesFormatted = formatWitnesses(state.witnesses);

  // For lease, consideration is usually monthly rent or security deposit. Let's format security deposit as consideration and rent as advance.
  const rentStr = formatIndianCurrency(state.transaction.considerationAmount);
  const rentWords = numberToIndianWords(state.transaction.considerationAmount);
  const depositStr = formatIndianCurrency(state.transaction.advancePaid || 0);
  const depositWords = numberToIndianWords(state.transaction.advancePaid || 0);

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
      contentEn: '<h2 class="text-center font-bold underline text-slate-900 text-sm">DEED OF LEASE</h2>',
      contentTa: '<h2 class="text-center font-bold underline text-slate-900 text-sm">வாடகை / குத்தகை பத்திரம்</h2>'
    },
    {
      id: 'intro',
      titleEn: 'Introductory Declaration',
      titleTa: 'அறிமுகப் பிரகடனம்',
      contentEn: `This DEED OF LEASE is executed at <strong>${state.property.sro || 'Chennai'}</strong> on this <strong>${formattedEnglishDate}</strong>.`,
      contentTa: `இந்த வாடகை / குத்தகை பத்திரம் <strong>${state.property.sro || 'சென்னை'}</strong> சார்பதிவக எல்லைக்குள் <strong>${formattedEnglishDate}</strong> அன்று எழுதப்பட்டது.`
    },
    {
      id: 'parties',
      titleEn: 'Description of Parties',
      titleTa: 'தரப்பினர் விவரம்',
      contentEn: `
        <div class="space-y-2">
          <p><strong>BY AND BETWEEN:</strong></p>
          <p>${lessorsFormatted.en} (hereinafter referred to as the <strong>LESSOR</strong> / LANDLORD)</p>
          <p class="font-bold py-1">AND</p>
          <p>${lesseesFormatted.en} (hereinafter referred to as the <strong>LESSEE</strong> / TENANT)</p>
        </div>
      `,
      contentTa: `
        <div class="space-y-2">
          <p><strong>உரிமையாளர் மற்றும் வாடகைதாரர் விவரம்:</strong></p>
          <p>${lessorsFormatted.ta} (இனிமேல் "<strong>வீட்டு உரிமையாளர்</strong>" என்று அழைக்கப்படுபவர்)</p>
          <p class="font-bold py-1">மற்றும்</p>
          <p>${lesseesFormatted.ta} (இனிமேல் "<strong>வாடகைதாரர்</strong>" என்று அழைக்கப்படுபவர்)</p>
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
          <p>1. The LESSOR is the absolute owner and in vacant, peaceful possession of the scheduled property described in the schedule hereunder, having purchased/acquired the same through a <strong>${state.ownershipHistory.parentDocType || 'Sale Deed'}</strong> bearing Document No. <strong>${state.ownershipHistory.parentDocNo || '————'}</strong> at SRO <strong>${state.ownershipHistory.parentDocSRO || '————'}</strong>.</p>
          <p>2. The Lessee has approached the Lessor to take the Scheduled Property on lease/rent for residential or commercial purposes, and the Lessor has agreed to grant lease of the same on the terms and conditions hereinafter set out.</p>
        </div>
      `,
      contentTa: `
        <div class="space-y-2">
          <p><strong>சொத்து வரலாறு விவரம்:</strong></p>
          <p>1. இக்குத்தகை/வாடகை பத்திரத்தில் விவரிக்கப்பட்டுள்ள சொத்தானது வீட்டு உரிமையாளருக்கு சொந்தமான தடையற்ற சொத்தாகும். இச்சொத்து வீட்டு உரிமையாளருக்கு முந்தைய ஆவண எண் <strong>${state.ownershipHistory.parentDocNo || '————'}</strong> ஆக <strong>${state.ownershipHistory.parentDocSRO || '————'}</strong> சார்பதிவகத்தில் பதிவானதாகும்.</p>
          <p>2. வாடகைதாரர் தனது குடியிருப்பு/வணிக தேவைக்காக வீட்டு உரிமையாளரிடம் இருந்து இச்சொத்தை வாடகைக்கு எடுக்க அணுகியுள்ளார், வீட்டு உரிமையாளரும் கீழ் குறிப்பிட்ட நிபந்தனைகளுக்கு உட்பட்டு வாடகைக்கு விட ஒப்புக்கொண்டுள்ளார்.</p>
        </div>
      `
    },
    {
      id: 'transaction',
      titleEn: 'Lease Terms & Security Deposit',
      titleTa: 'வாடகை நிபந்தனைகள் மற்றும் முன்பணம்',
      contentEn: `
        <div class="space-y-2">
          <p>NOW THIS DEED WITNESSETH that the Lessor hereby lets and leases the Scheduled Property to the Lessee on the following commercial terms:</p>
          <ul class="list-disc pl-5">
            <li>Monthly Rent Amount: <strong>${rentStr}</strong> (${rentWords}) per month, payable on or before the 5th of each calendar month.</li>
            <li>Refundable Security Deposit: <strong>${depositStr}</strong> (${depositWords}) paid by the Lessee, the receipt of which is hereby acknowledged by the Lessor.</li>
            <li>Lease Period: <strong>11 Months</strong> starting from <strong>${state.transaction.paymentDate || '————'}</strong>.</li>
            <li>Payment Mode: <strong>${state.transaction.paymentMode || 'RTGS/NEFT'}</strong></li>
          </ul>
        </div>
      `,
      contentTa: `
        <div class="space-y-2">
          <p>இதன்படி, வீட்டு உரிமையாளர் இச்சொத்தை வாடகைதாரருக்கு வாடகைக்கு விட பின்வரும் வணிக நிபந்தனைகளுக்கு உட்பட்டு ஒப்புக்கொள்கிறார்:</p>
          <ul class="list-disc pl-5">
            <li>மாதாந்திர வாடகைத் தொகை: <strong>${rentStr}</strong> (${rentWords}) ஆகும், இத்தொகை ஒவ்வொரு ஆங்கில மாதத்தின் 5-ம் தேதிக்குள் செலுத்தப்பட வேண்டும்.</li>
            <li>வட்டி இல்லா வாடகை முன்பணம் (Advance): <strong>${depositStr}</strong> (${depositWords}) ஆகும், இத்தொகையை வீட்டு உரிமையாளர் முழுமையாக பெற்றுக்கொண்டுள்ளார்.</li>
            <li>வாடகை காலம்: <strong>11 மாதங்கள்</strong>, <strong>${state.transaction.paymentDate || '————'}</strong> முதல் அமலுக்கு வருகிறது.</li>
            <li>வாடகை செலுத்தும் முறை: <strong>${state.transaction.paymentMode || 'RTGS/NEFT'}</strong></li>
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
          <p><strong>THE LESSOR AND LESSEE MUTUALLY COVENANT AS FOLLOWS:</strong></p>
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
          <p>IN WITNESS WHEREOF, the LESSOR and the LESSEE have signed and delivered this Lease Deed in the presence of the following witnesses:</p>
          <div class="mt-4 border-l-2 border-slate-300 pl-4">
            ${witnessesFormatted.en}
          </div>
        </div>
      `,
      contentTa: `
        <div class="space-y-2">
          <p>இதற்குச் சாட்சியாக, வீட்டு உரிமையாளரும் வாடகைதாரரும் தங்களின் முழு சம்மதத்துடன் இக்குத்தகை/வாடகை பத்திரத்தில் கீழ் குறிப்பிட்ட சாட்சிகளின் முன்னிலையில் கையொப்பமிட்டுள்ளனர்:</p>
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
            <p className="font-bold">LESSOR (LANDLORD)</p>
            <p className="text-slate-500 mt-8">Name: ${lessorsFormatted.collectiveEn}</p>
          </div>
          <div class="border-t border-slate-300 pt-3">
            <p className="font-bold">LESSEE (TENANT)</p>
            <p className="text-slate-500 mt-8">Name: ${lesseesFormatted.collectiveEn}</p>
          </div>
        </div>
      `,
      contentTa: `
        <div class="grid grid-cols-2 gap-8 pt-6 font-mono text-xs">
          <div class="border-t border-slate-300 pt-3">
            <p className="font-bold">வீட்டு உரிமையாளர்</p>
            <p className="text-slate-500 mt-8">பெயர்: ${lessorsFormatted.collectiveTa}</p>
          </div>
          <div class="border-t border-slate-300 pt-3">
            <p className="font-bold">வாடகைதாரர்</p>
            <p className="text-slate-500 mt-8">பெயர்: ${lesseesFormatted.collectiveTa}</p>
          </div>
        </div>
      `
    }
  ];
}
