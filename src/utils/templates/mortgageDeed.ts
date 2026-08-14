import { DeedWizardState } from '../../types';
import { formatParties, formatWitnesses } from '../partyFormatter';
import { generatePropertySchedule } from '../propertyScheduleGenerator';
import { formatIndianCurrency, numberToIndianWords } from '../amountFormatter';
import { generateClausesSection } from '../clauseInjectionEngine';

export function generateMortgageDeed(state: DeedWizardState) {
  const mortgagors = state.parties.filter(p => p.role === 'Donor' || p.role === 'Seller' || p.id === 'p1');
  const mortgagees = state.parties.filter(p => p.role === 'Donee' || p.role === 'Buyer' || p.id === 'p2');

  const mortgagorsFormatted = formatParties(mortgagors, 'Seller'); // map to Mortgagor
  const mortgageesFormatted = formatParties(mortgagees, 'Buyer'); // map to Mortgagee
  const scheduleFormatted = generatePropertySchedule(
    state.property,
    state.survey,
    state.surveys,
    state.extent,
    state.boundary
  );
  const clausesFormatted = generateClausesSection(state.selectedClauses, state);
  const witnessesFormatted = formatWitnesses(state.witnesses);

  const loanAmountStr = formatIndianCurrency(state.transaction.considerationAmount);
  const loanAmountWords = numberToIndianWords(state.transaction.considerationAmount);

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
      contentEn: '<h2 class="text-center font-bold underline text-slate-900 text-sm">DEED OF SIMPLE MORTGAGE</h2>',
      contentTa: '<h2 class="text-center font-bold underline text-slate-900 text-sm">அடமானப் பத்திரம்</h2>'
    },
    {
      id: 'intro',
      titleEn: 'Introductory Declaration',
      titleTa: 'அறிமுகப் பிரகடனம்',
      contentEn: `This DEED OF SIMPLE MORTGAGE is executed at <strong>${state.property.sro || 'Chennai'}</strong> on this <strong>${formattedEnglishDate}</strong>.`,
      contentTa: `இந்த அடமானப் பத்திரம் <strong>${state.property.sro || 'சென்னை'}</strong> சார்பதிவக எல்லைக்குள் <strong>${formattedEnglishDate}</strong> அன்று எழுதப்பட்டது.`
    },
    {
      id: 'parties',
      titleEn: 'Description of Parties',
      titleTa: 'தரப்பினர் விவரம்',
      contentEn: `
        <div class="space-y-2">
          <p><strong>BY AND BETWEEN:</strong></p>
          <p>${mortgagorsFormatted.en} (hereinafter referred to as the <strong>MORTGAGOR</strong> / BORROWER)</p>
          <p class="font-bold py-1">AND</p>
          <p>${mortgageesFormatted.en} (hereinafter referred to as the <strong>MORTGAGEE</strong> / LENDER)</p>
        </div>
      `,
      contentTa: `
        <div class="space-y-2">
          <p><strong>அடமானம் வைப்பவர் மற்றும் பெறுபவர் விவரம்:</strong></p>
          <p>${mortgagorsFormatted.ta} (இனிமேல் "<strong>கடன்பெறுபவர் / அடமானம் வைப்பவர்</strong>" என்று அழைக்கப்படுபவர்)</p>
          <p class="font-bold py-1">மற்றும்</p>
          <p>${mortgageesFormatted.ta} (இனிமேல் "<strong>கடன் வழங்குபவர் / அடமானம் பெறுபவர்</strong>" என்று அழைக்கப்படுபவர்)</p>
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
          <p>1. The MORTGAGOR is the absolute owner of the scheduled property described in the schedule hereunder, having purchased/acquired the same through registered <strong>${state.ownershipHistory.parentDocType || 'Sale Deed'}</strong> Document No. <strong>${state.ownershipHistory.parentDocNo || '————'}</strong>.</p>
          <p>2. The Mortgagor is in need of funds for business/personal expenses and has requested the Mortgagee to advance a loan of <strong>${loanAmountStr}</strong>, which the Mortgagee has agreed to do upon the Mortgagor executing simple mortgage of the Scheduled Property as security for the repayment of the loan.</p>
        </div>
      `,
      contentTa: `
        <div class="space-y-2">
          <p><strong>சொத்து வரலாறு விவரம்:</strong></p>
          <p>1. இவ்டமானப் பத்திரத்தில் விவரிக்கப்பட்டுள்ள சொத்தானது அடமானம் வைப்பவருக்கு சொந்தமான தடையற்ற சொத்தாகும். இச்சொத்து அடமானம் வைப்பவருக்கு முந்தைய ஆவண எண் <strong>${state.ownershipHistory.parentDocNo || '————'}</strong> ஆக <strong>${state.ownershipHistory.parentDocSRO || '————'}</strong> சார்பதிவகத்தில் பதிவானதாகும்.</p>
          <p>2. அடமானம் வைப்பவருக்கு தனது குடும்ப/வியாபாரத் தேவைகளுக்காக கடன் தேவைப்படுவதால், அதற்காக அடமானம் பெறுபவரிடம் இருந்து <strong>${loanAmountStr}</strong> தொகையை கடனாகப் பெற்றுக்கொண்டுள்ளார், அதற்கு பிணையமாக இச்சொத்தை அடமானம் வைக்க ஒப்புக்கொண்டுள்ளார்.</p>
        </div>
      `
    },
    {
      id: 'transaction',
      titleEn: 'Mortgage Terms & Loan Particulars',
      titleTa: 'அடமான நிபந்தனைகள் மற்றும் கடன் விவரங்கள்',
      contentEn: `
        <div class="space-y-2">
          <p>NOW THIS DEED WITNESSETH that in consideration of the sum of <strong>${loanAmountStr}</strong> (${loanAmountWords}) received by the Mortgagor on or before the execution of this deed, the Mortgagor hereby charges, mortgages, and secures the Scheduled Property hereunder to the Mortgagee.</p>
          <ul class="list-disc pl-5">
            <li>Loan Principal Amount: <strong>${loanAmountStr}</strong></li>
            <li>Interest Rate: <strong>12% per annum</strong></li>
            <li>Repayment Period: <strong>24 Months</strong> from date hereof</li>
            <li>Payment Mode: <strong>${state.transaction.paymentMode || 'RTGS/NEFT'}</strong></li>
            <li>Transaction Reference: <strong>${state.transaction.paymentRefNo || '————'}</strong></li>
          </ul>
        </div>
      `,
      contentTa: `
        <div class="space-y-2">
          <p>இதன்படி, அடமானம் வைப்பவர் பெற்றுக்கொண்ட கடன் தொகையான <strong>${loanAmountStr}</strong> (${loanAmountWords}) க்கு பிணையமாக இச்சொத்தின் மீதான அடமானப் பொறுப்பை அடமானம் பெறுபவருக்கு மாற்றி எழுதுகிறார்.</p>
          <ul class="list-disc pl-5">
            <li>அசல் கடன் தொகை: <strong>${loanAmountStr}</strong></li>
            <li>வட்டி விகிதம்: <strong>ஆண்டிற்கு 12%</strong></li>
            <li>திருப்பிச் செலுத்தும் காலம்: <strong>24 மாதங்கள்</strong></li>
            <li>கடன் பெற்ற முறை: <strong>${state.transaction.paymentMode || 'RTGS/NEFT'}</strong></li>
            <li>பரிவர்த்தனை குறிப்பு எண்: <strong>${state.transaction.paymentRefNo || '————'}</strong></li>
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
          <p><strong>THE MORTGAGOR AND MORTGAGEE MUTUALLY COVENANT AS FOLLOWS:</strong></p>
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
          <p>IN WITNESS WHEREOF, the MORTGAGOR and the MORTGAGEE have signed and delivered this Mortgage Deed in the presence of the following witnesses:</p>
          <div class="mt-4 border-l-2 border-slate-300 pl-4">
            ${witnessesFormatted.en}
          </div>
        </div>
      `,
      contentTa: `
        <div class="space-y-2">
          <p>இதற்குச் சாட்சியாக, அடமானம் வைப்பவரும் அடமானம் பெறுபவரும் தங்களின் முழு சம்மதத்துடன் இவ்வடமானப் பத்திரத்தில் கீழ் குறிப்பிட்ட சாட்சிகளின் முன்னிலையில் கையொப்பமிட்டுள்ளனர்:</p>
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
            <p className="font-bold">MORTGAGOR (BORROWER)</p>
            <p className="text-slate-500 mt-8">Name: ${mortgagorsFormatted.collectiveEn}</p>
          </div>
          <div class="border-t border-slate-300 pt-3">
            <p className="font-bold">MORTGAGEE (LENDER)</p>
            <p className="text-slate-500 mt-8">Name: ${mortgageesFormatted.collectiveEn}</p>
          </div>
        </div>
      `,
      contentTa: `
        <div class="grid grid-cols-2 gap-8 pt-6 font-mono text-xs">
          <div class="border-t border-slate-300 pt-3">
            <p className="font-bold">அடமானம் வைப்பவர்</p>
            <p className="text-slate-500 mt-8">பெயர்: ${mortgagorsFormatted.collectiveTa}</p>
          </div>
          <div class="border-t border-slate-300 pt-3">
            <p className="font-bold">அடமானம் பெறுபவர்</p>
            <p className="text-slate-500 mt-8">பெயர்: ${mortgageesFormatted.collectiveTa}</p>
          </div>
        </div>
      `
    }
  ];
}
