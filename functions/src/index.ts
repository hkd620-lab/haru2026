import { onCall, HttpsError } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import * as logger from "firebase-functions/logger";
import { VertexAI } from "@google-cloud/vertexai";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// 1. 초기화 (DB 및 환경 설정)
initializeApp();
const db = getFirestore();
setGlobalOptions({ region: "asia-northeast3" });

// 2. Vertex AI 설정 (구글 추천 엔터프라이즈 방식)
const project = "haru2026-8abb8";
const location = "asia-northeast3";
const vertexAI = new VertexAI({ project: project, location: location });

// 허교장님께서 성공하신 2.5-flash 모델 적용
const generativeModel = vertexAI.getGenerativeModel({
  model: "gemini-2.5-flash", 
});

/* =========================================
   3. [SAYU 다듬기] 원본 저장 + AI 교정
========================================= */
export const polishSayu = onCall(async (request) => {
  try {
    const { observation, impression, comparison, action } = request.data;
    const combinedText = `[관찰]: ${observation}\n[인상]: ${impression}\n[비교]: ${comparison}\n[실행]: ${action}`;

    // [원본 저장] raw_sayu 폴더에 날것 그대로 기록
    const rawDoc = await db.collection("raw_sayu").add({
      sections: { observation, impression, comparison, action },
      createdAt: FieldValue.serverTimestamp(),
      status: "original"
    });

    // [AI 호출] 전문가용 Vertex AI 엔진 가동
    const prompt = `너는 전문 교정 편집기다. 다음 내용을 정갈한 에세이로 다듬어줘. 내용을 지어내지 마라.\n\n[INPUT]\n${combinedText}`;
    const result = await generativeModel.generateContent(prompt);
    
    // Vertex AI 응답에서 텍스트 추출
    const response = await result.response;
    const output = response.candidates?.[0].content.parts[0].text || "";

    return { 
      text: output,
      rawDocId: rawDoc.id 
    };
  } catch (e: any) {
    logger.error("Vertex AI Error:", e);
    throw new HttpsError("internal", e.message || "AI 처리 실패");
  }
});

/* =========================================
   4. [최종 저장] 사용자가 승인한 글 저장
========================================= */
export const saveFinalSayu = onCall(async (request) => {
  try {
    const { finalContent, rawDocId } = request.data;
    if (!finalContent) throw new HttpsError("invalid-argument", "내용이 없습니다.");

    const docRef = await db.collection("final_sayu").add({
      content: finalContent,
      relatedRawId: rawDocId || "", // 원본과 짝을 지어줌
      savedAt: FieldValue.serverTimestamp(),
      status: "final_confirmed"
    });

    return { success: true, id: docRef.id };
  } catch (e: any) {
    throw new HttpsError("internal", e.message);
  }
});
