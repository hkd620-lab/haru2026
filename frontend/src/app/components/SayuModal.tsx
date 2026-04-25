import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { X, Printer, Copy, Download, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useSubscription } from '../hooks/useSubscription';
import { useLoading } from '../contexts/LoadingContext';
import { HaruLogoAnimation } from './HaruLogoAnimation';
import { doc, getDoc, updateDoc, deleteDoc, deleteField, arrayRemove } from 'firebase/firestore';
import { ref, listAll, deleteObject, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, storage, functions } from '../../firebase';
import { useAuth } from '../contexts/AuthContext';

const WEATHER_OPTIONS = ['쾌청', '흐림', '비', '눈'];
const TEMPERATURE_OPTIONS = ['폭염', '온난', '쾌적', '쌀쌀', '혹한'];

export interface SayuModalProps {
  isOpen: boolean;
  onClose: (deleted?: boolean) => void;
  content: string;
  originalData?: Record<string, string>;
  format?: string;
  dateLabel: string;
  currentRating?: number;
  onSave: (content: string, rating: number) => void;
  recordDate?: string;
  weather?: string;
  temperature?: string;
  mood?: string;
  images?: string[];
  formatKey?: string;
  onRefresh?: () => void;
  firestoreId?: string;
  title?: string;
}

export function formatDateToKorean(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = days[date.getDay()];
  
  return `${year}년 ${month}월 ${day}일 ${dayOfWeek}요일`;
}

export function SayuModal({
  isOpen,
  onClose,
  content,
  originalData,
  format,
  dateLabel,
  currentRating,
  onSave,
  recordDate,
  weather,
  temperature,
  mood,
  images = [],
  formatKey,
  onRefresh,
  firestoreId,
  title,
}: SayuModalProps) {
  const { isPremium } = useSubscription();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const { showLoading, showLoadingWithProgress, updateProgress, hideLoading } = useLoading();
  const [editedContent, setEditedContent] = useState(content);
  const [isSaving, setIsSaving] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isSpecialDay, setIsSpecialDay] = useState(false);
  const [viewMode, setViewMode] = useState<'ai' | 'original'>('ai');
  const [editedOriginalData, setEditedOriginalData] = useState<Record<string, string>>(originalData || {});
  const [isSavingOriginal, setIsSavingOriginal] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [editedWeather, setEditedWeather] = useState(weather || '');
  const [editedTemperature, setEditedTemperature] = useState(temperature || '');
  const [localImages, setLocalImages] = useState<string[]>(images || []);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [editedTitle, setEditedTitle] = useState(title || '');

  // 🗑 형식 삭제
  const handleDeleteFormat = async () => {
    console.log('🗑️ 삭제 시도:', { currentUser: currentUser?.uid, recordDate, firestoreId, formatKey });
    if (!currentUser || (!recordDate && !firestoreId) || !formatKey) {
      console.log('❌ 가드 조건 실패 - 삭제 중단');
      return;
    }
    setIsDeleting(true);
    try {
      // 1. Storage: {date}_{formatKey}_ 접두사 파일 삭제
      const storageRef = ref(storage, `users/${currentUser.uid}/format_photos/`);
      const listResult = await listAll(storageRef);
      const filesToDelete = listResult.items.filter((item) =>
        item.name.startsWith(`${recordDate}_${formatKey}_`)
      );
      await Promise.allSettled(filesToDelete.map((file) => deleteObject(file)));

      // 2. Firestore: 해당 형식 필드 삭제 (firestoreId 우선, 없으면 recordDate 폴백)
      const docId = firestoreId || recordDate!;
      const recordRef = doc(db, 'users', currentUser.uid, 'records', docId);
      const recordSnap = await getDoc(recordRef);
      if (recordSnap.exists()) {
        const data = recordSnap.data();
        console.log('[DELETE] recordDate:', recordDate);
        console.log('[DELETE] formatKey:', formatKey);
        console.log('[DELETE] all fields:', Object.keys(data));
        const fieldsToDelete = Object.keys(data).filter(
          (k) => k === formatKey || k.startsWith(`${formatKey}_`)
        );
        console.log('[DELETE] fieldsToDelete:', fieldsToDelete);
        const remainingFormatFields = Object.keys(data).filter(
          (k) =>
            !fieldsToDelete.includes(k) &&
            !['weather', 'temperature', 'mood', 'date', 'formats'].includes(k)
        );

        const formatLabelMap: Record<string, string> = {
          diary: '일기',
          essay: '에세이',
          travel: '여행기록',
          garden: '텃밭일지',
          pet: '애완동물관찰일지',
          child: '육아일기',
          mission: '선교보고',
          report: '일반보고',
          work: '업무일지',
          memo: '메모',
        };
        const formatLabel = formatLabelMap[formatKey] ?? formatKey;

        if (remainingFormatFields.length === 0) {
          await deleteDoc(recordRef);
        } else {
          const updateData: Record<string, ReturnType<typeof deleteField> | ReturnType<typeof arrayRemove>> = {};
          fieldsToDelete.forEach((f) => {
            updateData[f] = deleteField();
          });
          updateData['formats'] = arrayRemove(formatLabel);
          await updateDoc(recordRef, updateData);
        }
      }

      toast.success('삭제되었습니다.');
      onClose(true);
      onRefresh?.();
    } catch (error) {
      console.error('삭제 실패:', error);
      toast.error('삭제에 실패했습니다.');
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  // 인쇄 함수 - 포도송이 최대한 길게 + 안내 메시지
  const handlePrint = () => {
    if (!editedContent || editedContent.trim().length === 0) {
      toast.error('저장된 내용이 없습니다. 먼저 내용을 저장해주세요.');
      return;
    }

    showLoading('인쇄 준비 중');
    setIsPrinting(true);
    setProgress(0);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const validImages = (localImages || []).filter((src) => src && src !== '');

        const doPrint = () => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              window.print();
              setTimeout(() => {
                hideLoading();
                setIsPrinting(false);
              }, 800);
            });
          });
        };

        if (validImages.length === 0) {
          // 이미지 없어도 포도송이 2초 보여주기
          setTimeout(doPrint, 2000);
          return;
        }

        let loaded = 0;
        validImages.forEach((src) => {
          const img = new Image();
          const done = () => {
            loaded++;
            const pct = Math.round((loaded / validImages.length) * 100);
            setProgress(pct);
            updateProgress(pct);
            if (loaded === validImages.length) {
              // 이미지 로딩 완료 후 포도송이 추가 2초 더 보여주기
              setTimeout(doPrint, 2000);
            }
          };
          img.onload = done;
          img.onerror = done;
          img.src = src;
        });
      });
    });
  };

  // 💾 PDF 저장 (파일명 지정 후 window.print)
  const handleSavePDF = () => {
    if (!isPremium) {
      alert('PREMIUM 구독 후 이용 가능한 기능입니다.\n월 3,000원으로 시작해 보세요!');
      window.location.href = '/subscription';
      return;
    }
    const originalTitle = document.title;
    document.title = `HARU_SAYU_${recordDate || 'sayu'}.pdf`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  // 📋 복사 (Word/Gmail용 - HTML)
  const handleCopyWithImages = async () => {
    try {
      toast.info('복사 중입니다...');
      
      // HTML 생성
      const dateText = recordDate ? formatDateToKorean(recordDate) : dateLabel;
      const envParts: string[] = [];
      if (weather) envParts.push(`날씨: ${weather}`);
      if (temperature) envParts.push(`기온: ${temperature}`);
      if (mood) envParts.push(`기분: ${mood}`);
      const envText = envParts.length > 0 ? `<p style="color: #666; font-size: 14px; margin: 8px 0;">${envParts.join(' | ')}</p>` : '';
      
      let imagesHTML = '';
      if (images && images.length > 0) {
        const imagesList = images.map(img => `<img src="${img}" style="width: 200px; max-width: 200px; height: auto; margin: 8px; border-radius: 8px; display: inline-block;" />`).join('\n');
        imagesHTML = `<div style="margin: 16px 0; text-align: center;">${imagesList}</div>`;
      }
      
      const htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 700px; padding: 20px;">
          <h2 style="color: #1A3C6E; margin-bottom: 8px;">${dateText}</h2>
          ${envText}
          ${imagesHTML}
          <div style="white-space: pre-wrap; line-height: 1.6; color: #333; margin-top: 16px;">${editedContent}</div>
        </div>
      `;
      
      // ClipboardItem으로 복사
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const data = [new ClipboardItem({ 'text/html': blob })];
      await navigator.clipboard.write(data);
      
      toast.success('✅ 복사되었습니다! Word나 Gmail에 붙여넣기 하세요.');
    } catch (error) {
      console.error('복사 실패:', error);
      toast.error('❌ 복사에 실패했습니다.');
    }
  };

  // 📝 텍스트 복사 (카톡/메모용)
  const handleCopyText = async () => {
    try {
      toast.info('텍스트 복사 중...');
      
      const dateText = recordDate ? formatDateToKorean(recordDate) : dateLabel;
      const envParts: string[] = [];
      if (weather) envParts.push(`날씨: ${weather}`);
      if (temperature) envParts.push(`기온: ${temperature}`);
      if (mood) envParts.push(`기분: ${mood}`);
      
      let textContent = `${dateText}\n`;
      if (envParts.length > 0) {
        textContent += `${envParts.join(' | ')}\n`;
      }
      textContent += `\n${editedContent}`;
      
      // 이미지 URL 추가
      if (images && images.length > 0) {
        textContent += `\n\n📷 사진 ${images.length}장\n`;
        images.forEach((img, idx) => {
          textContent += `${idx + 1}. ${img}\n`;
        });
      }
      
      await navigator.clipboard.writeText(textContent);
      toast.success('✅ 텍스트가 복사되었습니다! 카톡에 붙여넣기 하세요.');
    } catch (error) {
      console.error('텍스트 복사 실패:', error);
      toast.error('❌ 복사에 실패했습니다.');
    }
  };

  // 📄 HTML 다운로드
  const handleDownloadHTML = () => {
    try {
      toast.info('HTML 파일 생성 중...');
      
      const dateText = recordDate ? formatDateToKorean(recordDate) : dateLabel;
      const envParts: string[] = [];
      if (weather) envParts.push(`날씨: ${weather}`);
      if (temperature) envParts.push(`기온: ${temperature}`);
      if (mood) envParts.push(`기분: ${mood}`);
      const envText = envParts.length > 0 ? `<p style="color: #666; font-size: 14px; margin: 8px 0;">${envParts.join(' | ')}</p>` : '';
      
      let imagesHTML = '';
      if (images && images.length > 0) {
        const imagesList = images.map(img => `<img src="${img}" style="width: 300px; max-width: 300px; height: auto; margin: 10px; border-radius: 8px;" />`).join('\n');
        imagesHTML = `<div style="margin: 20px 0; text-align: center;">${imagesList}</div>`;
      }
      
      const htmlContent = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${dateText} - HARU SAYU</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Apple SD Gothic Neo', sans-serif;
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      background: #FEFBE8;
      color: #333;
    }
    .container {
      background: white;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    h1 {
      color: #1A3C6E;
      margin-bottom: 12px;
      font-size: 24px;
    }
    .env {
      color: #666;
      font-size: 14px;
      margin: 12px 0;
    }
    .images {
      margin: 24px 0;
      text-align: center;
    }
    .images img {
      width: 300px;
      max-width: 300px;
      height: auto;
      margin: 10px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .content {
      white-space: pre-wrap;
      line-height: 1.8;
      font-size: 15px;
      margin-top: 24px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>✨ ${dateText}</h1>
    ${envText ? `<div class="env">${envText.replace(/<\/?p[^>]*>/g, '')}</div>` : ''}
    ${imagesHTML ? `<div class="images">${imagesHTML.replace(/<div[^>]*>|<\/div>/g, '')}</div>` : ''}
    <div class="content">${editedContent}</div>
  </div>
</body>
</html>`;
      
      // Blob 생성 및 다운로드
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${recordDate || 'sayu'}_${new Date().getTime()}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('✅ HTML 파일이 다운로드되었습니다!');
    } catch (error) {
      console.error('HTML 다운로드 실패:', error);
      toast.error('❌ 다운로드에 실패했습니다.');
    }
  };

  useEffect(() => {
    if (isOpen) {
      console.log('📌 formatKey:', formatKey, 'recordDate:', recordDate);
      setEditedContent(content);
      setEditedWeather(weather || '');
      setEditedTemperature(temperature || '');
      setEditedTitle(title || '');
      setLocalImages((images || []).filter(url => typeof url === 'string' && url.trim().length > 0 && url.startsWith('http')));
      setIsSpecialDay((currentRating || 0) > 0);
      setViewMode('ai');
      setIsPrinting(false);
      setShowDeleteDialog(false);
      const baseData = originalData || {};
      setEditedOriginalData(baseData);

      // 🌱 텃밭일지: garden_crop 없으면 Firestore에서 작물목록 보완
      if ((format === '텃밭일지' || formatKey === 'garden') && !baseData['garden_crop']?.trim() && currentUser?.uid) {
        (async () => {
          try {
            const gardenRef = doc(db, 'users', currentUser.uid, 'settings', 'garden');
            const snap = await getDoc(gardenRef);
            if (snap.exists()) {
              const data = snap.data();
              const crops: string[] = Array.isArray(data.crops) ? data.crops : [];
              if (crops.length > 0) {
                setEditedOriginalData(prev => ({ ...prev, garden_crop: crops.join(', ') }));
              }
            }
          } catch {
            // 조용히 실패 — 기존 데이터 그대로 유지
          }
        })();
      }

      // 이미지 프리로드 - 브라우저 캐시 활용
      if (images && images.length > 0) {
        images.forEach((imageUrl) => {
          const img = new Image();
          img.src = imageUrl; // 캐시에 저장됨
        });
      }
    }
  }, [isOpen, content, currentRating, images, format]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (currentUser && firestoreId) {
        const recordRef = doc(db, 'users', currentUser.uid, 'records', firestoreId);
        const titleUpdate: Record<string, string> = {
          weather: editedWeather,
          temperature: editedTemperature,
        };
        if (formatKey) {
          titleUpdate[`${formatKey}_title`] = editedTitle.trim();
        }
        await updateDoc(recordRef, titleUpdate);
      }
      onSave(editedContent, isSpecialDay ? 1 : 0);
      toast.success('✅ SAYU가 최종 저장되었습니다!');
      onClose();
    } catch (error) {
      console.error('저장 실패:', error);
      toast.error('❌ 저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteImage = async (imageUrl: string, index: number) => {
    if (!currentUser || !firestoreId || !formatKey) return;
    try {
      // Storage에서 삭제 (URL에서 파일명 추출)
      try {
        const decodedUrl = decodeURIComponent(imageUrl);
        const fileName = decodedUrl.split('/format_photos/')[1]?.split('?')[0];
        if (fileName) {
          const imageRef = ref(storage, `users/${currentUser.uid}/format_photos/${fileName}`);
          await deleteObject(imageRef);
        }
      } catch {
        // Storage 삭제 실패해도 Firestore는 업데이트
      }
      // Firestore 업데이트
      const newImages = localImages
        .filter((_, i) => i !== index)
        .filter(url => typeof url === 'string' && url.trim().length > 0 && url.startsWith('http'));
      setLocalImages(newImages);
      const recordRef = doc(db, 'users', currentUser.uid, 'records', firestoreId);
      await updateDoc(recordRef, {
        [`${formatKey}_images`]: JSON.stringify(newImages),
      });
      toast.success('사진이 삭제되었습니다.');
    } catch (err) {
      console.error('사진 삭제 실패:', err);
      toast.error('사진 삭제에 실패했습니다.');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser || !firestoreId || !formatKey) return;
    if (localImages.length >= 3) {
      toast.error('사진은 최대 3장까지 추가할 수 있습니다.');
      return;
    }
    setIsUploadingImage(true);
    try {
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 8);
      const fileName = `${recordDate}_${formatKey}_${timestamp}_${randomId}.jpg`;
      const imageRef = ref(storage, `users/${currentUser.uid}/format_photos/${fileName}`);
      await uploadBytes(imageRef, file);
      const url = await getDownloadURL(imageRef);
      const newImages = [...localImages, url];
      setLocalImages(newImages);
      const recordRef = doc(db, 'users', currentUser.uid, 'records', firestoreId);
      await updateDoc(recordRef, {
        [`${formatKey}_images`]: JSON.stringify(newImages),
      });
      toast.success('사진이 추가되었습니다!');
    } catch (err) {
      console.error('사진 업로드 실패:', err);
      toast.error('사진 업로드에 실패했습니다.');
    } finally {
      setIsUploadingImage(false);
      e.target.value = '';
    }
  };

  // 💾 원본 저장
  const handleSaveOriginal = async () => {
    if (!currentUser || !editedOriginalData || Object.keys(editedOriginalData).length === 0 || (!recordDate && !firestoreId)) return;
    setIsSavingOriginal(true);
    try {
      const docId = firestoreId || recordDate!;
      const recordRef = doc(db, 'users', currentUser.uid, 'records', docId);
      await updateDoc(recordRef, editedOriginalData);
      toast.success('저장되었습니다 ✓');
    } catch (error) {
      console.error('원본 저장 실패:', error);
      toast.error('저장 실패. 다시 시도해주세요.');
    } finally {
      setIsSavingOriginal(false);
    }
  };

  // ✨ 다시 다듬기
  const handleRepolish = async () => {
    if (!currentUser || !formatKey || (!recordDate && !firestoreId)) return;
    setIsRefining(true);
    showLoading('AI가 다듬고 있습니다');
    try {
      const contentValues = Object.values(editedOriginalData)
        .filter(v => v && v.trim())
        .join('\n\n');
      if (!contentValues.trim()) {
        toast.error('다듬을 내용이 없습니다.');
        return;
      }
      const polishContentFunc = httpsCallable(functions, 'polishContent');
      const result = await polishContentFunc({
        text: `다음은 "${format || formatKey}" 형식으로 작성된 기록입니다. 이 내용을 자연스럽고 읽기 좋게 교정해주세요.\n\n${contentValues}`,
        format: formatKey,
        mode: 'PREMIUM',
      });
      const responseData = result.data as { text: string };
      const polished = responseData.text;
      const docId = firestoreId || recordDate!;
      const recordRef = doc(db, 'users', currentUser.uid, 'records', docId);
      await updateDoc(recordRef, { [`${formatKey}_sayu`]: polished });
      setEditedContent(polished);
      setViewMode('ai');
      toast.success('✨ 다시 다듬기가 완료되었습니다!');
    } catch (error) {
      console.error('다시 다듬기 실패:', error);
      toast.error('다시 다듬기에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsRefining(false);
      hideLoading();
    }
  };

  const getEnvironmentHeader = () => {
    if (!recordDate) return '';

    let header = `📅 ${formatDateToKorean(recordDate)}\n`;
    
    const envParts: string[] = [];
    if (weather) envParts.push(`날씨: ${weather}`);
    if (temperature) envParts.push(`기온: ${temperature}`);
    if (mood) envParts.push(`기분: ${mood}`);
    
    if (envParts.length > 0) {
      header += `🌤️ ${envParts.join(' | ')}\n`;
    }

    return header;
  };

  const renderOriginalData = () => {
    if (!editedOriginalData || Object.keys(editedOriginalData).length === 0) {
      return (
        <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
          <p>저장된 원본 데이터가 없습니다.</p>
          <p style={{fontSize: '11px', marginTop: '8px'}}>
            (사유가 AI로만 생성되었거나, 원본이 저장되지 않았을 수 있습니다)
          </p>
        </div>
      );
    }

    // garden_crop을 상단에 먼저 표시하기 위해 정렬
    const sortedEntries = Object.entries(editedOriginalData).sort(([keyA], [keyB]) => {
      if (keyA === 'garden_crop') return -1;
      if (keyB === 'garden_crop') return 1;
      return 0;
    });

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {sortedEntries.map(([key, value]) => {
          let displayLabel = key;
          if (key === 'garden_crop') {
            displayLabel = '🌱 식물종류';
          } else if (key.includes('_')) {
            const parts = key.split('_');
            if (parts.length > 1) {
              const label = parts[1];
              displayLabel = label.charAt(0).toUpperCase() + label.slice(1);
            }
          } else {
            displayLabel = key.charAt(0).toUpperCase() + key.slice(1);
          }

          const isTitle = key.endsWith('_title');

          return (
            <div key={key} style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #eee' }}>
              <span style={{
                display: 'inline-block',
                fontSize: '11px',
                fontWeight: '600',
                color: '#1A3C6E',
                backgroundColor: '#FDF6C3',
                padding: '4px 8px',
                borderRadius: '4px',
                marginBottom: '8px'
              }}>
                {displayLabel}
              </span>
              {isTitle ? (
                <input
                  value={value}
                  onChange={(e) => setEditedOriginalData(prev => ({ ...prev, [key]: e.target.value }))}
                  style={{
                    display: 'block',
                    width: '100%',
                    fontSize: '16px',
                    lineHeight: '1.6',
                    color: '#333',
                    border: '1px solid #d0dff0',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    backgroundColor: '#fafcff',
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                  }}
                />
              ) : (
                <textarea
                  value={value}
                  onChange={(e) => {
                    setEditedOriginalData(prev => ({ ...prev, [key]: e.target.value }));
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                  }}
                  onFocus={(e) => {
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    fontSize: '16px',
                    lineHeight: '1.6',
                    color: '#333',
                    border: '1px solid #d0dff0',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    backgroundColor: '#fafcff',
                    outline: 'none',
                    resize: 'none',
                    overflow: 'hidden',
                    minHeight: '72px',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                    whiteSpace: 'pre-wrap',
                  }}
                  rows={3}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      {isPrinting && (
        <div
          className="print-loading-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(250, 249, 246, 0.97)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            willChange: 'opacity',
            pointerEvents: 'all',
          }}
        >
          {/* 포도송이 애니메이션 */}
          <HaruLogoAnimation />

          {/* 메인 메시지 */}
          <p
            style={{
              color: '#1A3C6E',
              fontSize: '17px',
              fontWeight: 600,
              letterSpacing: '0.5px',
              margin: '40px 0 12px 0',
            }}
          >
            PDF 준비 중입니다
          </p>

          {/* 안내 메시지 */}
          <p
            style={{
              color: '#666',
              fontSize: '13px',
              fontWeight: 400,
              lineHeight: '1.6',
              textAlign: 'center',
              margin: '0 0 24px 0',
              padding: '0 24px',
            }}
          >
            사진이 많은 경우 최대 2~3분 정도<br />
            소요될 수 있습니다. 잠시만 기다려 주세요.
          </p>

          {/* 진행률 표시 (이미지가 있을 때만) */}
          {(localImages || []).filter((s) => s && s !== '').length > 0 && (
            <div
              style={{
                width: '200px',
                height: '6px',
                background: '#E5E7EB',
                borderRadius: '3px',
                overflow: 'hidden',
                marginTop: '8px',
              }}
            >
              <div
                style={{
                  width: `${progress || 0}%`,
                  height: '100%',
                  background: '#10b981',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          )}
        </div>
      )}
      <style>{`
        /* 인쇄 스타일 - 달력 제외, 환경+사진+본문만 출력, 2페이지 확장 허용 */
        @media print {
          /* 화면 전용 요소 완전 숨김 */
          .no-print,
          .no-print *,
          .sayu-page-container,
          .print-loading-overlay {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            position: absolute !important;
            left: -9999px !important;
          }

          /* 인쇄 전용만 표시 */
          .print-show {
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
            position: relative !important;
            left: 0 !important;
            top: 0 !important;
            z-index: 9999 !important;
            background: white !important;
          }

          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            height: auto !important;
            background: white !important;
          }

          html {
            overflow: visible !important;
            height: auto !important;
            background: white !important;
          }

          /* 모든 요소 overflow visible - 긴 텍스트 클리핑 방지 */
          * {
            overflow: visible !important;
            max-height: none !important;
            box-shadow: none !important;
            text-shadow: none !important;
          }

          /* 인쇄 페이지 레이아웃 - 2페이지 확장 허용 */
          .sayu-print-page {
            width: 100% !important;
            min-height: auto !important;
            padding: 15mm !important;
            page-break-after: auto !important;
            background: white !important;
            position: relative !important;
            box-sizing: border-box !important;
          }

          .sayu-print-header {
            background: white !important;
          }

          .sayu-print-header h2 {
            font-size: 14pt !important;
            color: #1A3C6E !important;
            margin: 0 0 10px 0 !important;
            font-weight: 600 !important;
          }

          .print-photos {
            background: white !important;
          }

          .sayu-print-content {
            font-size: 11pt !important;
            line-height: 1.8 !important;
            color: #333 !important;
            white-space: pre-wrap !important;
            word-wrap: break-word !important;
            overflow: visible !important;
            page-break-inside: auto !important;
            background: white !important;
          }

          .sayu-print-content p {
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }

          /* 그림자 제거 */
          * {
            box-shadow: none !important;
            text-shadow: none !important;
          }
        }

        @media screen {
          .print-show {
            position: fixed !important;
            left: -9999px !important;
            top: 0 !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
          }
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .sayu-modal-overlay {
          padding: 0;
        }
        .sayu-modal-inner {
          max-width: 100%;
          width: 100%;
        }
        @media (min-width: 640px) {
          .sayu-modal-overlay {
            padding: 20px;
          }
          .sayu-modal-inner {
            max-width: 480px;
          }
        }
      `}</style>

      {isOpen && (
      <div
        className="no-print sayu-modal-overlay"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}
        onClick={() => onClose()}
      >
        <div
          className="sayu-modal-inner"
          style={{
            backgroundColor: '#FEFBE8',
            borderRadius: 12,
            maxHeight: '90vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e5e5e5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#fff',
            }}
          >
            <div>
              <h2 style={{ fontSize: 18, color: '#1A3C6E', fontWeight: 600, margin: 0 }}>
                ✨ {dateLabel} SAYU
              </h2>
              {format && (
                <p style={{ fontSize: 12, color: '#999', marginTop: 4, marginBottom: 0 }}>
                  {format}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {/* 📝 텍스트 복사 버튼 (카톡용) */}
              <button
                onClick={handleCopyText}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="텍스트 복사 (카톡용)"
              >
                <FileText style={{ width: 20, height: 20, color: '#10b981' }} />
              </button>

              {/* 📋 이미지 복사 버튼 (Word용) */}
              <button
                onClick={handleCopyWithImages}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="이미지 복사 (Word/Gmail용)"
              >
                <Copy style={{ width: 20, height: 20, color: '#1A3C6E' }} />
              </button>
              
              {/* 💾 PDF 저장 버튼 */}
              <button
                onClick={handleSavePDF}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: isPremium ? 1 : 0.6,
                }}
                title={isPremium ? 'PDF 저장' : '🔒 PREMIUM 전용 기능'}
              >
                <Download style={{ width: 20, height: 20, color: 'currentColor' }} />
                {!isPremium && <span className="ml-1 text-xs">🔒</span>}
              </button>

              {/* 구분선 */}
              <div style={{ width: 1, height: 20, backgroundColor: '#e5e5e5', margin: '0 2px' }} />

              {/* 🖨️ 인쇄 버튼 */}
              <button
                onClick={handlePrint}
                disabled={isPrinting}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: isPrinting ? 'not-allowed' : 'pointer',
                  padding: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: isPrinting ? 0.5 : 1,
                }}
                title="인쇄"
              >
                <Printer style={{ width: 20, height: 20, color: 'currentColor' }} />
              </button>
              
              {/* 🗑 삭제 버튼 */}
              {formatKey && recordDate && (
                <button
                  onClick={() => setShowDeleteDialog(true)}
                  style={{
                    background: 'rgba(220,50,50,0.22)',
                    border: '1px solid rgba(220,80,80,0.5)',
                    color: '#f87171',
                    borderRadius: 8,
                    padding: '5px 12px',
                    fontSize: 13,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                  title="이 형식 기록 삭제"
                >
                  🗑 삭제
                </button>
              )}

              {/* ✕ 닫기 버튼 */}
              <button
                onClick={() => onClose()}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X style={{ width: 20, height: 20, color: '#666' }} />
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid #e5e5e5',
              backgroundColor: '#fff',
            }}
          >
            <button
              onClick={() => setViewMode('ai')}
              style={{
                flex: 1,
                padding: '12px',
                border: 'none',
                backgroundColor: viewMode === 'ai' ? '#FDF6C3' : 'transparent',
                color: viewMode === 'ai' ? '#1A3C6E' : '#999',
                fontSize: 14,
                fontWeight: viewMode === 'ai' ? 600 : 400,
                cursor: 'pointer',
                borderBottom: viewMode === 'ai' ? '2px solid #1A3C6E' : '2px solid transparent',
                transition: 'all 0.2s',
              }}
            >
              ✨ SAYU
            </button>
            <button
              onClick={() => setViewMode('original')}
              style={{
                flex: 1,
                padding: '12px',
                border: 'none',
                backgroundColor: viewMode === 'original' ? '#FDF6C3' : 'transparent',
                color: viewMode === 'original' ? '#1A3C6E' : '#999',
                fontSize: 14,
                fontWeight: viewMode === 'original' ? 600 : 400,
                cursor: 'pointer',
                borderBottom: viewMode === 'original' ? '2px solid #1A3C6E' : '2px solid transparent',
                transition: 'all 0.2s',
              }}
            >
              📝 원본
            </button>
          </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
            backgroundColor: '#fafafa',
          }}
        >
          {viewMode === 'ai' ? (
            <div>
              {/* 제목 입력 */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: 13, color: '#666', marginBottom: 6, fontWeight: 600 }}>
                  📌 제목
                </label>
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  placeholder="제목을 입력하세요"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '10px 14px', fontSize: 16,
                    border: '1px solid #d0dff0', borderRadius: 8,
                    backgroundColor: '#fff', color: '#333',
                    fontFamily: 'inherit', outline: 'none',
                  }}
                />
              </div>

              {/* 환경 정보 */}
              {(recordDate || weather || temperature || mood) && (
                <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e5e5' }}>
                  {recordDate && (
                    <p style={{ fontSize: '14px', fontWeight: '600', color: '#1A3C6E', marginBottom: '12px' }}>
                      📅 {formatDateToKorean(recordDate)}
                    </p>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* 날씨 선택 */}
                    <div>
                      <p style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>날씨</p>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {WEATHER_OPTIONS.map((w) => (
                          <button
                            key={w}
                            onClick={() => setEditedWeather(w)}
                            style={{
                              fontSize: 11,
                              padding: '3px 8px',
                              borderRadius: 6,
                              border: editedWeather === w ? 'none' : '1px solid #d0dff0',
                              backgroundColor: editedWeather === w ? '#1A3C6E' : '#FDF6C3',
                              color: editedWeather === w ? '#FAF9F6' : '#1A3C6E',
                              cursor: 'pointer',
                            }}
                          >
                            {w}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 기온 선택 */}
                    <div>
                      <p style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>기온</p>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {TEMPERATURE_OPTIONS.map((t) => (
                          <button
                            key={t}
                            onClick={() => setEditedTemperature(t)}
                            style={{
                              fontSize: 11,
                              padding: '3px 8px',
                              borderRadius: 6,
                              border: editedTemperature === t ? 'none' : '1px solid #d0dff0',
                              backgroundColor: editedTemperature === t ? '#1A3C6E' : '#FDF6C3',
                              color: editedTemperature === t ? '#FAF9F6' : '#1A3C6E',
                              cursor: 'pointer',
                            }}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 기분 */}
                    {mood && (
                      <div>
                        <p style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>기분</p>
                        <span style={{
                          fontSize: '12px',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          backgroundColor: '#FDF6C3',
                          color: '#1A3C6E',
                          border: '1px solid #d0dff0'
                        }}>
                          {mood}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 사진 표시 블록 */}
              {(() => {
                const validImages = (localImages || []).filter(img => img && img !== '');
                if (validImages.length === 0) return null;
                const hideOnError = (e: React.SyntheticEvent<HTMLImageElement>) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                };
                return (
                  <div style={{ marginBottom: '12px' }}>
                    {/* 1장 */}
                    {validImages.length === 1 && (
                      <div style={{ position: 'relative', display: 'block', margin: '0 auto', maxWidth: '320px' }}>
                        <img
                          src={validImages[0]}
                          alt="사진"
                          onError={hideOnError}
                          style={{
                            width: '100%',
                            height: 'auto',
                            objectFit: 'cover',
                            borderRadius: '8px',
                            border: '1px solid #e5e5e5'
                          }}
                        />
                        <button
                          onClick={() => handleDeleteImage(validImages[0], 0)}
                          style={{
                            position: 'absolute',
                            top: 6,
                            right: 6,
                            background: '#000000',
                            boxShadow: '0 0 0 2px #fff',
                            border: 'none',
                            borderRadius: '50%',
                            width: 28,
                            height: 28,
                            color: '#fff',
                            fontSize: 14,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          title="사진 삭제"
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    {/* 2장 */}
                    {validImages.length === 2 && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        {validImages.map((img, idx) => (
                          <div key={idx} style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
                            <img
                              src={img}
                              alt={`사진 ${idx + 1}`}
                              onError={hideOnError}
                              style={{
                                width: '100%',
                                height: '160px',
                                objectFit: 'cover',
                                borderRadius: '8px',
                                border: '1px solid #e5e5e5'
                              }}
                            />
                            <button
                              onClick={() => handleDeleteImage(validImages[idx], idx)}
                              style={{
                                position: 'absolute',
                                top: 6,
                                right: 6,
                                background: '#000000',
                            boxShadow: '0 0 0 2px #fff',
                                border: 'none',
                                borderRadius: '50%',
                                width: 28,
                                height: 28,
                                color: '#fff',
                                fontSize: 14,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                              title="사진 삭제"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 3장 이상 */}
                    {validImages.length >= 3 && (
                      <div>
                        <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
                          <img
                            src={validImages[0]}
                            alt="사진 1"
                            onError={hideOnError}
                            style={{
                              width: '100%',
                              height: '406px',
                              objectFit: 'cover',
                              borderRadius: '8px',
                              border: '1px solid #e5e5e5',
                              marginBottom: '12px'
                            }}
                          />
                          <button
                            onClick={() => handleDeleteImage(validImages[0], 0)}
                            style={{
                              position: 'absolute',
                              top: 6,
                              right: 6,
                              background: '#000000',
                            boxShadow: '0 0 0 2px #fff',
                              border: 'none',
                              borderRadius: '50%',
                              width: 28,
                              height: 28,
                              color: '#fff',
                              fontSize: 14,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            title="사진 삭제"
                          >
                            ✕
                          </button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
                            <img
                              src={validImages[1]}
                              alt="사진 2"
                              onError={hideOnError}
                              style={{
                                width: '100%',
                                height: '203px',
                                objectFit: 'cover',
                                borderRadius: '8px',
                                border: '1px solid #e5e5e5'
                              }}
                            />
                            <button
                              onClick={() => handleDeleteImage(validImages[1], 1)}
                              style={{
                                position: 'absolute',
                                top: 6,
                                right: 6,
                                background: '#000000',
                            boxShadow: '0 0 0 2px #fff',
                                border: 'none',
                                borderRadius: '50%',
                                width: 28,
                                height: 28,
                                color: '#fff',
                                fontSize: 14,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                              title="사진 삭제"
                            >
                              ✕
                            </button>
                          </div>
                          <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
                            <img
                              src={validImages[2]}
                              alt="사진 3"
                              onError={hideOnError}
                              style={{
                                width: '100%',
                                height: '203px',
                                objectFit: 'cover',
                                borderRadius: '8px',
                                border: '1px solid #e5e5e5'
                              }}
                            />
                            <button
                              onClick={() => handleDeleteImage(validImages[2], 2)}
                              style={{
                                position: 'absolute',
                                top: 6,
                                right: 6,
                                background: '#000000',
                            boxShadow: '0 0 0 2px #fff',
                                border: 'none',
                                borderRadius: '50%',
                                width: 28,
                                height: 28,
                                color: '#fff',
                                fontSize: 14,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                              title="사진 삭제"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                  </div>
                );
              })()}

              {/* 사진 추가 버튼 - IIFE 블록 완전 밖에 위치, 항상 표시 */}
              <input
                type="file"
                accept="image/*"
                id="sayu-image-upload"
                style={{
                  position: 'absolute',
                  width: 0,
                  height: 0,
                  opacity: 0,
                  overflow: 'hidden',
                  pointerEvents: 'none',
                }}
                onChange={handleImageUpload}
              />
              {localImages.length < 3 && (
                <div style={{ marginBottom: '16px' }}>
                  <button
                    onClick={() => document.getElementById('sayu-image-upload')?.click()}
                    disabled={isUploadingImage}
                    style={{
                      padding: '8px 20px',
                      fontSize: 13,
                      borderRadius: 8,
                      border: '1px dashed #1A3C6E',
                      backgroundColor: '#FDF6C3',
                      color: '#1A3C6E',
                      cursor: isUploadingImage ? 'not-allowed' : 'pointer',
                      opacity: isUploadingImage ? 0.5 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {isUploadingImage ? '⏳ 업로드 중...' : `📷 사진 추가 (${localImages.length}/3)`}
                  </button>
                </div>
              )}

              {/* 내용 없음 안내 */}
              {(!editedContent || editedContent.trim().length === 0) && (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#f87171' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
                  <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>내용이 없는 기록입니다.</p>
                  <p style={{ fontSize: 13, marginTop: 8, color: '#f87171' }}>삭제 버튼을 눌러 정리하세요.</p>
                </div>
              )}

              {/* SAYU 텍스트 편집 영역 */}
              <textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: '400px',
                  padding: '20px',
                  fontSize: 15,
                  lineHeight: 1.8,
                  border: '1px solid #e5e5e5',
                  borderRadius: 8,
                  backgroundColor: '#fff',
                  color: '#333',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  outline: 'none',
                  whiteSpace: 'pre-wrap',
                }}
                placeholder="SAYU 내용을 자유롭게 수정하세요..."
              />
            </div>
          ) : (
            renderOriginalData()
          )}
        </div>

        {/* Footer - AI 탭일 때만 별점/저장 버튼 표시 */}
        {viewMode === 'ai' && (
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid #e5e5e5',
            backgroundColor: '#fff',
          }}
        >
          <div style={{ marginBottom: '16px' }}>
            <button
              onClick={() => setIsSpecialDay(!isSpecialDay)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 20px',
                borderRadius: 10,
                border: `2px solid ${isSpecialDay ? '#F59E0B' : '#e5e5e5'}`,
                backgroundColor: isSpecialDay ? '#FFF8F0' : '#fff',
                color: isSpecialDay ? '#F59E0B' : '#aaa',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
                transition: 'all 0.2s',
              }}
            >
              <span style={{ fontSize: 20 }}>✨</span>
              특별한 날
              {isSpecialDay && (
                <span style={{ fontSize: 12, color: '#10b981', marginLeft: 4 }}>✓ 체크됨</span>
              )}
            </button>
          </div>

          {/* 🔮 이 기록으로 예언하기 — 본문 있을 때만 노출 */}
          {(editedContent?.trim() || content?.trim()) && (
            <div style={{ marginBottom: 12 }}>
              <button
                onClick={() => {
                  const recordContent = editedContent?.trim() || content?.trim() || '';
                  if (!recordContent) {
                    toast.error('예언할 기록 내용이 없습니다.');
                    return;
                  }
                  onClose();
                  navigate('/record-prophecy', {
                    state: {
                      incomingRecord: {
                        date: recordDate || '',
                        format: format || formatKey || '',
                        title: editedTitle || title || `${format || ''} — ${recordDate || ''}`,
                        content: recordContent,
                        rawData: originalData || {},
                      },
                    },
                  });
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1.5px solid #1A3C6E',
                  borderRadius: 10,
                  background: 'linear-gradient(90deg, #EEF3FA 0%, #fff 100%)',
                  color: '#1A3C6E',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                🔮 이 기록으로 예언하기
              </button>
              <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 6 }}>
                AI가 이 기록을 분석해 미래 서사를 만들어줍니다
              </p>
            </div>
          )}

          {/* 버튼 */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              onClick={() => onClose()}
              disabled={isSaving}
              style={{
                padding: '10px 20px',
                fontSize: 14,
                border: '1px solid #e5e5e5',
                borderRadius: 8,
                backgroundColor: '#fff',
                color: '#666',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                opacity: isSaving ? 0.5 : 1,
                fontWeight: 500,
              }}
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              style={{
                padding: '10px 24px',
                fontSize: 14,
                border: 'none',
                borderRadius: 8,
                backgroundColor: '#10b981',
                color: '#fff',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                opacity: isSaving ? 0.7 : 1,
                fontWeight: 600,
              }}
            >
              {isSaving ? '저장 중...' : '💾 최종 저장'}
            </button>
          </div>
        </div>
        )}

        {/* Footer - 원본 탭: 저장 + 다시 다듬기 */}
        {viewMode === 'original' && editedOriginalData && Object.keys(editedOriginalData).length > 0 && (
          <div
            style={{
              padding: '16px 20px',
              borderTop: '1px solid #e5e5e5',
              backgroundColor: '#fff',
            }}
          >
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={handleSaveOriginal}
                disabled={isSavingOriginal || isRefining}
                style={{
                  padding: '10px 20px',
                  fontSize: 14,
                  border: 'none',
                  borderRadius: 8,
                  backgroundColor: '#1A3C6E',
                  color: '#fff',
                  cursor: (isSavingOriginal || isRefining) ? 'not-allowed' : 'pointer',
                  opacity: (isSavingOriginal || isRefining) ? 0.6 : 1,
                  fontWeight: 600,
                }}
              >
                {isSavingOriginal ? '저장 중...' : '💾 저장'}
              </button>
              <button
                onClick={handleRepolish}
                disabled={isSavingOriginal || isRefining}
                style={{
                  padding: '10px 20px',
                  fontSize: 14,
                  border: 'none',
                  borderRadius: 8,
                  backgroundColor: '#10b981',
                  color: '#fff',
                  cursor: (isSavingOriginal || isRefining) ? 'not-allowed' : 'pointer',
                  opacity: (isSavingOriginal || isRefining) ? 0.6 : 1,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {isRefining ? (
                  <>
                    <span
                      style={{
                        display: 'inline-block',
                        width: 14,
                        height: 14,
                        border: '2px solid rgba(255,255,255,0.4)',
                        borderTopColor: '#fff',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                      }}
                    />
                    다듬는 중...
                  </>
                ) : '✨ 다시 다듬기'}
              </button>
            </div>
          </div>
        )}
      </div>
      </div>
      )}

      {/* 삭제 확인 다이얼로그 */}
      {isOpen && showDeleteDialog && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
          }}
          onClick={() => !isDeleting && setShowDeleteDialog(false)}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: 12,
              padding: '28px 24px',
              maxWidth: 320,
              width: '90%',
              textAlign: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 36, marginBottom: 12 }}>🗑</div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1A3C6E', margin: '0 0 8px' }}>
              기록 삭제
            </h3>
            <p style={{ fontSize: 14, color: '#555', lineHeight: 1.6, margin: '0 0 8px' }}>
              정말로 이 기록을 삭제하시겠습니까?
            </p>
            <p style={{ fontSize: 13, color: '#f87171', margin: '0 0 24px' }}>
              삭제된 기록은 복구할 수 없습니다.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setShowDeleteDialog(false)}
                disabled={isDeleting}
                style={{
                  flex: 1,
                  padding: '10px',
                  fontSize: 14,
                  border: '1px solid #e5e5e5',
                  borderRadius: 8,
                  backgroundColor: '#fff',
                  color: '#666',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  opacity: isDeleting ? 0.5 : 1,
                  fontWeight: 500,
                }}
              >
                취소
              </button>
              <button
                onClick={handleDeleteFormat}
                disabled={isDeleting}
                style={{
                  flex: 1,
                  padding: '10px',
                  fontSize: 14,
                  border: 'none',
                  borderRadius: 8,
                  backgroundColor: '#ef4444',
                  color: '#fff',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  opacity: isDeleting ? 0.7 : 1,
                  fontWeight: 600,
                }}
              >
                {isDeleting ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
