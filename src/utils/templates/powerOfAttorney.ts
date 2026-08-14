import { DeedWizardState } from '../../types';
import { formatParties, formatWitnesses } from '../partyFormatter';
import { generatePropertySchedule } from '../propertyScheduleGenerator';
import { formatIndianCurrency, numberToIndianWords } from '../amountFormatter';
import { generateClausesSection } from '../clauseInjectionEngine';

export function generatePowerOfAttorney(state: DeedWizardState) {
  const principals = state.parties.filter(p => p.role === 'Donor' || p.role === 'Seller' || p.id === 'p1');
  const agents = state.parties.filter(p => p.role === 'Donee' || p.role === 'Buyer' || p.role === 'Power Agent' || p.id === 'p2');

  const principalsFormatted = formatParties(principals, 'Seller'); // map to Principal
  const agentsFormatted = formatParties(agents, 'Power Agent'); // map to Power Agent
  const scheduleFormatted = generatePropertySchedule(
    state.property,
    state.survey,
    state.surveys,
    state.extent,
    state.boundary
  );
  const clausesFormatted = generateClausesSection(state.selectedClauses, state);
  const witnessesFormatted = formatWitnesses(state.witnesses);

  const valuationStr = formatIndianCurrency(state.transaction.marketValue || 1000);
  const valuationWords = numberToIndianWords(state.transaction.marketValue || 1000);

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
      contentEn: '<h2 class="text-center font-bold underline text-slate-900 text-sm">GENERAL POWER OF ATTORNEY</h2>',
      contentTa: '<h2 class="text-center font-bold underline text-slate-900 text-sm">பொது அதிகாரப் பத்திரம் (General POA)</h2>'
    },
    {
      id: 'intro',
      titleEn: 'Introductory Declaration',
      titleTa: 'அறிமுகப் பிரகடனம்',
      contentEn: `This GENERAL POWER OF ATTORNEY is executed at <strong>${state.property.sro || 'Chennai'}</strong> on this <strong>${formattedEnglishDate}</strong>.`,
      contentTa: `இந்த பொது அதிகாரப் பத்திரம் <strong>${state.property.sro || 'சென்னை'}</strong> சார்பதிவக எல்லைக்குள் <strong>${formattedEnglishDate}</strong> அன்று எழுதப்பட்டது.`
    },
    {
      id: 'parties',
      titleEn: 'Description of Parties',
      titleTa: 'தரப்பினர் விவரம்',
      contentEn: `
        <div class="space-y-2">
          <p><strong>BY AND BETWEEN:</strong></p>
          <p>${principalsFormatted.en} (hereinafter referred to as the <strong>PRINCIPAL</strong>)</p>
          <p class="font-bold py-1">AND</p>
          <p>${agentsFormatted.en} (hereinafter referred to as the <strong>POWER AGENT</strong>)</p>
        </div>
      `,
      contentTa: `
        <div class="space-y-2">
          <p><strong>முதல்வர் மற்றும் பொது அதிகார முகவர் விவரம்:</strong></p>
          <p>${principalsFormatted.ta} (இனிமேல் "<strong>முதல்வர்</strong>" என்று அழைக்கப்படுபவர்)</p>
          <p class="font-bold py-1">மற்றும்</p>
          <p>${agentsFormatted.ta} (இனிமேல் "<strong>பொது அதிகார முகவர்</strong>" என்று அழைக்கப்படுபவர்)</p>
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
          <p>1. The PRINCIPAL is the sole owner and in peaceful possession of the scheduled property described in the schedule hereunder, having purchased/acquired the same through Document No. <strong>${state.ownershipHistory.parentDocNo || '————'}</strong>.</p>
          <p>2. Due to personal reasons, business occupation, and other engagements, the Principal is unable to personally manage, superintend, sell, or register deeds for the Scheduled Property, and therefore desires to appoint the Power Agent to act on their behalf.</p>
        </div>
      `,
      contentTa: `
        <div class="space-y-2">
          <p><strong>சொத்து வரலாறு விவரம்:</strong></p>
          <p>1. இப்பொது அதிகாரப் பத்திரத்தில் விவரிக்கப்பட்டுள்ள சொத்தானது முதல்வருக்கு சொந்தமான தடையற்ற சொத்தாகும். இச்சொத்து முதல்வருக்கு முந்தைய ஆவண எண் <strong>${state.ownershipHistory.parentDocNo || '————'}</strong> ஆக <strong>${state.ownershipHistory.parentDocSRO || '————'}</strong> சார்பதிவகத்தில் பதிவானதாகும்.</p>
          <p>2. முதல்வருக்கு தனது தொழில் மற்றும் வெளிநாடு/இதர அவசர பயணங்கள் காரணமாக இச்சொத்தை நேரில் நிர்வகிக்கவோ, விற்கவோ அல்லது பதிவாளர் முன்னிலையில் கையெழுத்திடவோ இயலாததால், தங்களுக்குப் பதிலாக இச்சொத்தை நிர்வகித்து விற்க பொது அதிகார முகவரை நியமிக்க விரும்புகிறார்.</p>
        </div>
      `
    },
    {
      id: 'transaction',
      titleEn: 'Power of Attorney Authority & Powers Granted',
      titleTa: 'வழங்கப்படும் அதிகாரங்கள் மற்றும் பொறுப்புகள்',
      contentEn: `
        <div class="space-y-2">
          <p>NOW THIS DEED WITNESSETH that the Principal hereby appoints, constitutes, and nominates the Power Agent to do all or any of the following acts, deeds, and things on behalf of the Principal:</p>
          <ul class="list-decimal pl-5">
            <li>To manage, maintain, and protect the Scheduled Property.</li>
            <li>To represent the Principal before the SRO, Revenue Authorities, Municipal Corporation, and any government boards.</li>
            <li>To enter into sale agreements, receive advances, and execute registration deeds for sale or transfer.</li>
            <li>To pay all municipal taxes, electricity charges, and other outgoings.</li>
          </ul>
          <p>No monetary consideration is exchanged for granting this POA. The stamp duty evaluation is based on standard registration rules valued at <strong>${valuationStr}</strong> (${valuationWords}).</p>
        </div>
      `,
      contentTa: `
        <div class="space-y-2">
          <p>இதன்படி, முதல்வர் தனக்கு பதிலாக தன் சார்பில் சொத்துக்களை நிர்வகிக்க பின்வரும் அதிகாரங்களை பொது அதிகார முகவருக்கு முழுமையாக வழங்குகிறார்:</p>
          <ul class="list-decimal pl-5">
            <li>சொத்துக்களை நிர்வகிக்கவும், பராமரிக்கவும், பாதுகாக்கவும் அதிகாரம்.</li>
            <li>சார்பதிவகம், வருவாய்த்துறை, மாநகராட்சி மற்றும் இதர அரசு அலுவலகங்களில் முதல்வர் சார்பில் ஆஜராகி கையெழுத்திட அதிகாரம்.</li>
            <li>சொத்தை விற்கவோ, கிரய ஒப்பந்தம் செய்யவோ, முன்பணம் பெற்றுக்கொள்ளவோ மற்றும் கிரயப் பத்திரங்களை சார்பதிவாளர் முன்னிலையில் பதிவு செய்து கையொப்பமிட முழு அதிகாரம்.</li>
            <li>சொத்துவரி, மின்சார கட்டணம் மற்றும் இதர அரசு வரிகளைச் செலுத்த அதிகாரம்.</li>
          </ul>
          <p>இந்த பொது அதிகாரப் பத்திரத்திற்கு எவ்வித பண பரிவர்த்தனையும் பெறப்படவில்லை. பத்திரப் பதிவு மதிப்பீடு: <strong>${valuationStr}</strong> (${valuationWords}) ஆகும்.</p>
        </div>
      `
    },
    {
      id: 'clauses',
      titleEn: 'Covenants & Clauses',
      titleTa: 'உடன்படிக்கைகள் மற்றும் நிபந்தனைகள்',
      contentEn: `
        <div class="space-y-2">
          <p><strong>THE PRINCIPAL AND POWER AGENT COVENANT AS FOLLOWS:</strong></p>
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
          <p>IN WITNESS WHEREOF, the PRINCIPAL has signed and delivered this General Power of Attorney on the day, month, and year first above written in the presence of the following witnesses:</p>
          <div class="mt-4 border-l-2 border-slate-300 pl-4">
            ${witnessesFormatted.en}
          </div>
        </div>
      `,
      contentTa: `
        <div class="space-y-2">
          <p>இதற்குச் சாட்சியாக, முதல்வர் தன் முழு சம்மதத்துடன் இப்பொது அதிகாரப் பத்திரத்தில் கீழ் குறிப்பிட்ட சாட்சிகளின் முன்னிலையில் கையொப்பமிட்டுள்ளார்:</p>
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
            <p className="font-bold">PRINCIPAL (GRANTOR)</p>
            <p className="text-slate-500 mt-8">Name: ${principalsFormatted.collectiveEn}</p>
          </div>
          <div class="border-t border-slate-300 pt-3">
            <p className="font-bold">POWER AGENT (RECEIVER)</p>
            <p className="text-slate-500 mt-8">Name: ${agentsFormatted.collectiveEn}</p>
          </div>
        </div>
      `,
      contentTa: `
        <div class="grid grid-cols-2 gap-8 pt-6 font-mono text-xs">
          <div class="border-t border-slate-300 pt-3">
            <p className="font-bold">முதல்வர் (அதிகாரம் கொடுப்பவர்)</p>
            <p className="text-slate-500 mt-8">பெயர்: ${principalsFormatted.collectiveTa}</p>
          </div>
          <div class="border-t border-slate-300 pt-3">
            <p className="font-bold">பொது அதிகார முகவர் (அதிகாரம் பெறுபவர்)</p>
            <p className="text-slate-500 mt-8">பெயர்: ${agentsFormatted.collectiveTa}</p>
          </div>
        </div>
      `
    }
  ];
}
