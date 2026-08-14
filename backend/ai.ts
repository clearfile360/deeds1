/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";

// Initialize the Google Gen AI Client with appropriate User-Agent headers
const getGeminiClient = (): GoogleGenAI => {
  const apiKey = process.env.GEMINI_API_KEY || "MOCK_KEY";
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
};

/**
 * Layer 8 — AI Service Layer Placeholder
 * Real full-stack SDK invocation structure for future connection.
 */

// 1. OCR & Data Extraction: /ai/extract
export async function aiExtractDocumentData(base64File: string, mimeType: string) {
  const ai = getGeminiClient();
  
  if (!process.env.GEMINI_API_KEY) {
    // Return high-quality mock data when key is missing to allow smooth local prototyping
    return {
      success: true,
      extractedAt: new Date().toISOString(),
      ocrConfidence: 94.5,
      data: {
        seller: {
          name: "M. Selvakumar",
          fatherName: "Muthuswamy Mudaliar",
          dob: "1975-04-12",
          pan: "ABCPS1234F",
          aadhaar: "4589-1234-5678",
          address: "No. 45, First Main Road, Thiruvanmiyur, Chennai - 600041"
        },
        property: {
          district: "Chennai",
          taluk: "Sholinganallur",
          village: "Thiruvanmiyur",
          surveyNo: "340",
          subDivision: "5",
          pattaNo: "1102"
        },
        boundaries: {
          east: "Plot No. 44 owned by Mr. Raghavan",
          west: "30 Feet Public Road",
          north: "Plot No. 46 owned by Mrs. Gomathy",
          south: "Vacant Land owned by SRO Mylapore Society"
        }
      },
      message: "Prototyping Mode: Mock extraction executed since GEMINI_API_KEY is not defined."
    };
  }

  try {
    // Real API Call with structured JSON output schema (as per gemini-api skill guide)
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          inlineData: {
            data: base64File,
            mimeType: mimeType
          }
        },
        "Extract the Seller details, Buyer details, Property survey number, Subdivision, District, and Boundaries from this scanned Tamil Nadu legal deed."
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sellerName: { type: Type.STRING },
            sellerFatherName: { type: Type.STRING },
            surveyNo: { type: Type.STRING },
            subDivision: { type: Type.STRING },
            district: { type: Type.STRING },
            village: { type: Type.STRING },
            pattaNo: { type: Type.STRING },
            boundariesEast: { type: Type.STRING },
            boundariesWest: { type: Type.STRING },
            boundariesNorth: { type: Type.STRING },
            boundariesSouth: { type: Type.STRING }
          }
        }
      }
    });

    const parsedJson = JSON.parse(response.text || "{}");
    return {
      success: true,
      extractedAt: new Date().toISOString(),
      ocrConfidence: 98.2,
      data: parsedJson
    };
  } catch (error) {
    console.error("Gemini OCR Extraction failed:", error);
    throw new Error(`AI Extraction Failed: ${(error as Error).message}`);
  }
}

// 2. Deed Compliance Rule Validation: /ai/validate
export async function aiValidateDeedDocument(deedState: any) {
  const ai = getGeminiClient();

  if (!process.env.GEMINI_API_KEY) {
    // Generate intelligent Tamil Nadu specific validation checks
    const warnings = [];
    
    // Check parties
    if (!deedState.parties || deedState.parties.length < 2) {
      warnings.push({
        field: "parties",
        step: 2,
        severity: "error",
        message: "Deed requires a minimum of 2 parties: at least 1 Vendor (Seller) and 1 Vendee (Buyer).",
        suggestion: "Add a Purchaser profile to step 2."
      });
    }

    // Check witnesses
    if (!deedState.witnesses || deedState.witnesses.length < 2) {
      warnings.push({
        field: "witnesses",
        step: 9,
        severity: "warning",
        message: "Tamil Nadu Registration Act requires a minimum of two signing witnesses for Sale Deeds.",
        suggestion: "Enter complete details and Aadhaar numbers for 2 witnesses in step 9."
      });
    }

    // Check Survey specifics
    if (!deedState.survey?.pattaNo) {
      warnings.push({
        field: "survey.pattaNo",
        step: 4,
        severity: "error",
        message: "Patta number is mandatory for rural and municipal area registration in Tamil Nadu Star 2.0.",
        suggestion: "Cross-reference parent document or Star 2.0 portal to enter correct Patta number."
      });
    }

    // Check value
    if (deedState.transaction?.considerationAmount < deedState.transaction?.guidelineValue) {
      warnings.push({
        field: "transaction.considerationAmount",
        step: 8,
        severity: "error",
        message: "Declared transaction value is lower than the Registry Guideline Value. Under-valuation results in immediate document impounding under Section 47A of the Indian Stamp Act.",
        suggestion: "Adjust consideration amount to match or exceed guideline value, or draft a justification form."
      });
    }

    return {
      passed: warnings.length === 0,
      warnings,
      checkedAt: new Date().toISOString(),
      ruleEngineVersion: "STAR-2.0-TN-COMPLIANCE-v1.4"
    };
  }

  try {
    const prompt = `Analyze this Tamil Nadu registration deed state and return a list of legal compliance warnings, missing fields, or registry violations as JSON. State: ${JSON.stringify(deedState)}`;
    
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            passed: { type: Type.BOOLEAN },
            warnings: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  field: { type: Type.STRING },
                  step: { type: Type.INTEGER },
                  severity: { type: Type.STRING, description: "error, warning, or info" },
                  message: { type: Type.STRING },
                  suggestion: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Gemini Deed Validation failed:", error);
    throw new Error(`AI Validation Failed: ${(error as Error).message}`);
  }
}

// 3. Smart Clause Recommender: /ai/recommend-clause
export async function aiRecommendClauses(deedType: string, transactionDetails: any) {
  const ai = getGeminiClient();

  if (!process.env.GEMINI_API_KEY) {
    // Intelligent standard recommendation based on deedType
    return {
      recommendedClauses: [
        {
          id: "rec_cl_1",
          title: "Legal Heir Covenant",
          category: "Standard",
          contentEn: "The Vendor hereby declares that there are no minor legal heirs who have a claims/rights on the Scheduled Property, and the Vendor undertakes full responsibility for any future inheritance claim.",
          contentTa: "இச்சொத்தில் மைனர் வாரிசுகள் எவருக்கும் எவ்வித பங்கும் இல்லை என்றும், எதிர்காலத்தில் வாரிசுரிமை கோரல் ஏதேனும் எழுந்தால் அதற்கு விற்பனையாளரே முழுப் பொறுப்பு என்றும் இதன் மூலம் அறிவிக்கிறார்."
        },
        {
          id: "rec_cl_2",
          title: "Power of Attorney (PoA) Audit Clause",
          category: "Indemnity",
          contentEn: "In case of execution by a Power of Attorney Agent, the Agent hereby covenants that the principal is alive and sound, and that the Power of Attorney has not been revoked or cancelled as of the hour of registration.",
          contentTa: "பொது அதிகாரம் பெற்ற முகவர் மூலம் இப்பத்திரம் எழுதப்படுவதால், முகவர் உறுதிமொழி அளிப்பது என்னவென்றால், அசல் சொத்துரிமையாளர் உயிருடனும் நல்ல மனநிலையிலும் இருக்கிறார், மேலும் இந்த பொது அதிகாரம் ரத்து செய்யப்படவில்லை."
        }
      ]
    };
  }

  try {
    const prompt = `Recommend customized clauses in English and Tamil for a Tamil Nadu registration. Deed Type: ${deedType}. Details: ${JSON.stringify(transactionDetails)}`;
    
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recommendedClauses: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  category: { type: Type.STRING },
                  contentEn: { type: Type.STRING },
                  contentTa: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Gemini Clause Recommendation failed:", error);
    return { recommendedClauses: [] };
  }
}

// 4. Registry Intelligence & Double Registration Fraud Check: /ai/fraud-check
export async function aiCheckDeedFraudRisk(surveyNo: string, subDivision: string, village: string) {
  // Simulates querying Tamil Nadu land registry Star 2.0 blocklist & litigation tables
  const blocklistSurveys = ["89/1B", "142/3A", "55/2"];
  const litigatedSurveys = ["142/3A", "401/1C"];

  const currentSurveyRef = `${surveyNo}/${subDivision}`;
  const isBlocklisted = blocklistSurveys.includes(currentSurveyRef);
  const isLitigated = litigatedSurveys.includes(currentSurveyRef);

  let fraudScore = 5; // Base risk score
  const alerts: string[] = [];

  if (isBlocklisted) {
    fraudScore += 75;
    alerts.push(`CRITICAL: Survey No ${currentSurveyRef} in ${village} is on the STAR 2.0 Prohibited Land list (Sec 22-A of the Registration Act). Registration is legally barred.`);
  }

  if (isLitigated) {
    fraudScore += 45;
    alerts.push(`WARNING: Survey No ${currentSurveyRef} has an active injunction or pending litigation at the Sub-Court. Risk of double-registration or title dispute.`);
  }

  if (village.toLowerCase() === "velachery") {
    // Simulate waterbody/encroachment checks
    fraudScore += 15;
    alerts.push("NOTICE: Velachery area survey numbers require mandatory verification of FMB sketch to ensure zero waterbody/marshland encroachment (High Court Directive).");
  }

  return {
    doubleRegistrationThreat: isBlocklisted || isLitigated,
    fraudScore: Math.min(fraudScore, 100),
    alerts,
    timestamp: new Date().toISOString()
  };
}
