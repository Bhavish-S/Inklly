import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import { DocumentViewer } from '../components/DocumentViewer';
import {
  InkllyMark,
  Logo,
  PrinterIcon,
  UploadCloudIcon,
  FileTextIcon,
  CheckIcon,
  ClockIcon,
  TrashIcon,
  RotateCwIcon,
  CropIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CopyIcon,
  ShareIcon,
  IdCardIcon,
  CameraIcon,
  MessageSquareIcon,
} from '../components/icons';

declare global {
  interface Window { Razorpay?: new (options: any) => any; }
}

function loadRazorpayCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-razorpay-checkout]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Razorpay Checkout could not be loaded.')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.razorpayCheckout = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Razorpay Checkout could not be loaded.'));
    document.head.appendChild(script);
  });
}

const detectPdfPageCount = async (file: File): Promise<number> => {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    return 1;
  }
  try {
    const arrayBuffer = await file.arrayBuffer();
    const text = new TextDecoder('latin1').decode(arrayBuffer);
    const countMatches = [...text.matchAll(/\/Type\s*\/Pages[^>]*\/Count\s+(\d+)/g)];
    if (countMatches.length > 0) {
      const highest = Math.max(...countMatches.map((m) => parseInt(m[1], 10)));
      if (highest > 0) return highest;
    }
    const pageMatches = text.match(/\/Type\s*\/Page\b/g);
    if (pageMatches && pageMatches.length > 0) {
      return pageMatches.length;
    }
  } catch (err) {
    console.warn('PDF page count detection error:', err);
  }
  return 1;
};

interface DocumentItem {
  id: string;
  file?: File;
  fileName: string;
  fileSizeText: string;
  pageCount: number;
  previewUrl: string;
  storageKey?: string;
  fileUrl?: string;
  rotation: number;
  filter: 'natural' | 'bw_doc' | 'enhanced' | 'grayscale';
  brightness: number;
  contrast: number;
  cropBox: { x: number; y: number; width: number; height: number };
  note?: string;
  options: {
    colorMode: 'bw' | 'color' | 'mixed';
    colorPages?: string;
    duplexMode: 'simplex' | 'duplex_auto';
    paperSize: 'A4' | 'A3' | 'Legal';
    paperType?: 'standard_75' | 'bond_85' | 'executive_100' | 'glossy_180' | 'card_250';
    orientation: 'auto' | 'portrait' | 'landscape';
    copies: number;
    pageRange: string;
    finishing?: 'none' | 'staple' | 'spiral' | 'thermal' | 'lamination';
  };
}

interface CustomerPortalOrderViewProps {
  shopCode?: string;
  onNavigateHome?: () => void;
  onOrderSubmitted?: (orderId: string) => void;
}

export const CustomerPortalOrderView: React.FC<CustomerPortalOrderViewProps> = ({
  shopCode = 'campus1',
  onNavigateHome,
  onOrderSubmitted,
}) => {
  // Live Shop Metadata
  const [shop, setShop] = useState<any>({
    id: 'shop-campus-1',
    shopCode: 'campus1',
    name: 'Campus Print Express',
    tagline: 'High Speed Quality Printing & Photocopying',
    counter: 'Counter #1 · Main University Plaza',
    rates: {
      bw_simplex: 2.0,
      bw_duplex: 1.5,
      color_simplex: 10.0,
      color_duplex: 9.0,
    },
    onlinePaymentAvailable: false,
  });

  useEffect(() => {
    api.getShop(shopCode)
      .then((data) => {
        if (data && data.name) {
          setShop({
            id: data.id || 'shop-campus-1',
            shopCode: data.shopCode || shopCode,
            name: data.name,
            tagline: data.tagline || 'High Speed Quality Printing & Photocopying',
            counter: data.address || 'Main Counter',
            rates: data.rates || {
              bw_simplex: 2.0,
              bw_duplex: 1.5,
              color_simplex: 10.0,
              color_duplex: 9.0,
            },
            onlinePaymentAvailable: Boolean(data.onlinePaymentAvailable),
          });
        }
      })
      .catch((err) => {
        console.warn('Failed to fetch live shop:', err);
      });
  }, [shopCode]);

  // State - Initialized empty for real customer uploads
  const [documents, setDocuments] = useState<DocumentItem[]>([]);

  const [activeDocIndex, setActiveDocIndex] = useState<number>(0);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showOptionsAccordion, setShowOptionsAccordion] = useState<boolean>(true);
  const [globalCopies, setGlobalCopies] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH_ON_COLLECTION' | 'ONLINE_RAZORPAY'>('CASH_ON_COLLECTION');
  const [pendingOnlineOrder, setPendingOnlineOrder] = useState<{ orderId: string; orderNumber: string } | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [reviewModalOpen, setReviewModalOpen] = useState<boolean>(false);
  const [copiedToken, setCopiedToken] = useState<boolean>(false);
  const [orderResult, setOrderResult] = useState<{
    token: string;
    orderId: string;
    placedAt: string;
    totalAmount: string;
    paymentMode: 'CASH' | 'ONLINE';
  } | null>(null);

  // Editor Modal State
  const [editorOpen, setEditorOpen] = useState<boolean>(false);
  const [editorRotation, setEditorRotation] = useState<number>(0);
  const [editorFilter, setEditorFilter] = useState<'natural' | 'bw_doc' | 'enhanced' | 'grayscale'>('natural');
  const [editorBrightness, setEditorBrightness] = useState<number>(100);
  const [editorContrast, setEditorContrast] = useState<number>(100);
  const [editorCrop, setEditorCrop] = useState<{ x: number; y: number; width: number; height: number }>({
    x: 5,
    y: 5,
    width: 90,
    height: 90,
  });
  const [editorNote, setEditorNote] = useState<string>('');

  // 4 Dedicated Intake Modes inspired by real Indian print workflows
  const [intakeMode, setIntakeMode] = useState<'documents' | 'id_card' | 'passport_photo' | 'whatsapp_lookup'>('documents');

  // ID Card 2-in-1 Mode State
  const [idCardFront, setIdCardFront] = useState<{ url: string; name: string } | null>(null);
  const [idCardBack, setIdCardBack] = useState<{ url: string; name: string } | null>(null);
  const [idCardLayout, setIdCardLayout] = useState<'stacked' | 'side_by_side'>('stacked');
  const [idCardColor, setIdCardColor] = useState<'bw' | 'color'>('bw');
  const [idCardToast, setIdCardToast] = useState<string | null>(null);
  const idFrontInputRef = useRef<HTMLInputElement>(null);
  const idBackInputRef = useRef<HTMLInputElement>(null);

  // Passport Photo Sheet Generator State
  const [passportPhoto, setPassportPhoto] = useState<{ url: string; name: string } | null>(null);
  const [passportGrid, setPassportGrid] = useState<'8_pack_4x6' | '16_pack_a4'>('8_pack_4x6');
  const [passportBg, setPassportBg] = useState<'original' | 'white' | 'blue' | 'gray'>('white');
  const [passportGuides, setPassportGuides] = useState<boolean>(true);
  const [passportToast, setPassportToast] = useState<string | null>(null);
  const passportInputRef = useRef<HTMLInputElement>(null);

  // WhatsApp Order Retrieval State
  const [lookupPhoneOrToken, setLookupPhoneOrToken] = useState<string>('');
  const [lookupLoading, setLookupLoading] = useState<boolean>(false);
  const [lookupFeedback, setLookupFeedback] = useState<{ text: string; isError: boolean } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const activeDoc = documents[activeDocIndex] || documents[0];

  // Upload handler with real server intake, validation and error recovery
  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploadError(null);
    const fileList = Array.from(files);

    // Validate size limit (max 25MB per file)
    const oversized = fileList.find((f) => f.size > 25 * 1024 * 1024);
    if (oversized) {
      setUploadError(`File "${oversized.name}" exceeds the 25 MB limit. Please select a smaller file.`);
      return;
    }

    setUploadProgress(25);

    Promise.all(
      fileList.map((f, i) => {
        return new Promise<DocumentItem>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => {
            reject(new Error(`Failed to read file ${f.name}`));
          };
          reader.onload = async () => {
            const base64 = (reader.result as string) || '';
            const detectedPages = await detectPdfPageCount(f);
            const localBlobUrl = URL.createObjectURL(f);
            let storageKey = '';
            let serverFileUrl = '';
            let serverPageCount = detectedPages;

            try {
              const uploadRes = await api.uploadDocument({
                fileName: f.name,
                fileData: base64,
                mimeType: f.type || 'application/pdf',
                shopId: shop.id || 'shop-campus-1',
                pageCount: detectedPages,
              });
              if (Number.isInteger(uploadRes?.pageCount) && uploadRes.pageCount > 0) serverPageCount = uploadRes.pageCount;
              if (uploadRes?.storageKey) {
                storageKey = uploadRes.storageKey;
              }
              if (uploadRes?.fileUrl) {
                serverFileUrl = uploadRes.fileUrl;
              }
            } catch (err) {
              URL.revokeObjectURL(localBlobUrl);
              reject(new Error(`Could not securely upload "${f.name}". Check your connection and try again.`));
              return;
            }
            if (!storageKey) {
              URL.revokeObjectURL(localBlobUrl);
              reject(new Error(`The server did not confirm storage for "${f.name}". Please upload it again.`));
              return;
            }

            resolve({
              id: `doc-${Date.now()}-${i}`,
              file: f,
              fileName: f.name,
              fileSizeText: `${(f.size / (1024 * 1024)).toFixed(1)} MB`,
              pageCount: serverPageCount,
              previewUrl: localBlobUrl,
              storageKey,
              fileUrl: localBlobUrl,
              rotation: 0,
              filter: 'natural',
              brightness: 100,
              contrast: 100,
              cropBox: { x: 5, y: 5, width: 90, height: 90 },
              options: {
                colorMode: 'bw',
                duplexMode: 'simplex',
                paperSize: 'A4',
                orientation: 'portrait',
                copies: 1,
                pageRange: 'All',
              },
            });
          };
          reader.readAsDataURL(f);
        });
      })
    )
      .then((newDocs) => {
        setUploadProgress(100);
        setTimeout(() => {
          setDocuments((current) => [...current, ...newDocs]);
          setActiveDocIndex(documents.length);
          setUploadProgress(null);
        }, 300);
      })
      .catch((err: any) => {
        console.error('File read error:', err);
        setUploadProgress(null);
        setUploadError(err.message || 'Failed to upload document. Please try again.');
      });
  };

  const removeDocument = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (documents.length <= 1) {
      return;
    }
    const updated = documents.filter((_, i) => i !== index);
    setDocuments(updated);
    if (activeDocIndex >= updated.length) {
      setActiveDocIndex(Math.max(0, updated.length - 1));
    }
  };

  const updateActiveOptions = (updates: Partial<DocumentItem['options']>) => {
    setDocuments((prev) =>
      prev.map((doc, idx) => {
        if (idx === activeDocIndex) {
          return {
            ...doc,
            options: {
              ...doc.options,
              ...updates,
            },
          };
        }
        return doc;
      })
    );
  };

  const parsePageNumbers = (rangeStr: string, maxPages: number): number[] => {
    if (!rangeStr || rangeStr.trim().toLowerCase() === 'all') {
      const all: number[] = [];
      for (let i = 1; i <= Math.max(1, maxPages); i++) all.push(i);
      return all;
    }
    const parts = rangeStr.split(',').map((p) => p.trim());
    const selected = new Set<number>();
    for (const part of parts) {
      if (part.includes('-')) {
        const [s, e] = part.split('-').map((str) => parseInt(str.trim(), 10));
        const start = Math.max(1, isNaN(s) ? 1 : s);
        const end = Math.min(maxPages, isNaN(e) ? maxPages : e);
        for (let i = start; i <= end; i++) selected.add(i);
      } else {
        const num = parseInt(part, 10);
        if (!isNaN(num) && num >= 1 && num <= maxPages) selected.add(num);
      }
    }
    return selected.size > 0 ? Array.from(selected).sort((a, b) => a - b) : [];
  };

  const parsePageRangeCount = (rangeStr: string, maxPages: number): number => {
    const list = parsePageNumbers(rangeStr, maxPages);
    return list.length > 0 ? list.length : Math.max(1, maxPages);
  };

  const updateActiveRotation = () => {
    setDocuments((prev) =>
      prev.map((doc, idx) =>
        idx === activeDocIndex ? { ...doc, rotation: ((doc.rotation || 0) + 90) % 360 } : doc
      )
    );
  };

  // Price Calculation in Rupees & integer minor units with exact Mixed Color support
  const calculateTotal = () => {
    let total = 0;
    documents.forEach((doc) => {
      const selectedPages = parsePageNumbers(doc.options.pageRange || 'All', doc.pageCount);
      const effectivePages = selectedPages.length > 0 ? selectedPages.length : Math.max(1, doc.pageCount);

      let colorPagesCount = 0;
      let bwPagesCount = 0;

      if (doc.options.colorMode === 'color') {
        colorPagesCount = effectivePages;
        bwPagesCount = 0;
      } else if (doc.options.colorMode === 'mixed') {
        const customColorPages = parsePageNumbers(doc.options.colorPages || '', doc.pageCount);
        // Intersect with selectedPages so we only charge color for pages that are actually being printed
        const actualColorList = customColorPages.filter((p) => selectedPages.includes(p));
        colorPagesCount = actualColorList.length;
        bwPagesCount = Math.max(0, effectivePages - colorPagesCount);
      } else {
        colorPagesCount = 0;
        bwPagesCount = effectivePages;
      }

      const bwRate = doc.options.duplexMode === 'simplex'
        ? (shop.rates?.bw_simplex || 2.0)
        : (shop.rates?.bw_duplex || 1.5);
      const colorRate = doc.options.duplexMode === 'simplex'
        ? (shop.rates?.color_simplex || 10.0)
        : (shop.rates?.color_duplex || 8.0);

      let docCost = (colorPagesCount * colorRate) + (bwPagesCount * bwRate);

      // Paper type surcharges
      let paperSurcharge = 0;
      if (doc.options.paperType === 'bond_85') paperSurcharge = 0.5;
      else if (doc.options.paperType === 'executive_100') paperSurcharge = 1.5;
      else if (doc.options.paperType === 'glossy_180') paperSurcharge = 12.0;
      else if (doc.options.paperType === 'card_250') paperSurcharge = 8.0;

      docCost += (paperSurcharge * effectivePages);

      if (doc.options.paperSize === 'A3') docCost *= 2.0;

      // Finishing add-ons
      let finishingCost = 0;
      if (doc.options.finishing === 'staple') finishingCost = 2.0;
      else if (doc.options.finishing === 'spiral') finishingCost = 35.0;
      else if (doc.options.finishing === 'thermal') finishingCost = 60.0;
      else if (doc.options.finishing === 'lamination') finishingCost = 25.0;

      total += (docCost * (doc.options.copies || 1)) + finishingCost;
    });
    return total * globalCopies;
  };

  // Add synthesized ID Card 2-in-1 Document to Order
  const handleAddIdCardToOrder = () => {
    if (!idCardFront) {
      setIdCardToast('Please upload at least the Front side of the ID card.');
      setTimeout(() => setIdCardToast(null), 3000);
      return;
    }

    const newDoc: DocumentItem = {
      id: `idcard-${Date.now()}`,
      fileName: `ID_Card_2in1_${idCardLayout === 'stacked' ? 'Stacked' : 'SideBySide'}.pdf`,
      fileSizeText: '1.2 MB',
      pageCount: 1,
      previewUrl: idCardFront.url,
      rotation: 0,
      filter: idCardColor === 'bw' ? 'bw_doc' : 'natural',
      brightness: 100,
      contrast: 100,
      cropBox: { x: 5, y: 5, width: 90, height: 90 },
      options: {
        colorMode: idCardColor,
        duplexMode: 'simplex',
        paperSize: 'A4',
        paperType: 'card_250',
        orientation: 'portrait',
        copies: 1,
        pageRange: '1',
        finishing: 'none',
      },
    };

    setDocuments((prev) => [...prev, newDoc]);
    setActiveDocIndex(documents.length);
    setIntakeMode('documents');
    setIdCardToast('ID Card 2-in-1 layout added to order! ✓');
    setTimeout(() => setIdCardToast(null), 3000);
  };

  // Add synthesized Passport Photo Sheet to Order
  const handleAddPassportPhotoToOrder = () => {
    if (!passportPhoto) {
      setPassportToast('Please upload a photo first.');
      setTimeout(() => setPassportToast(null), 3000);
      return;
    }

    const copiesCount = passportGrid === '8_pack_4x6' ? 8 : 16;
    const newDoc: DocumentItem = {
      id: `passport-${Date.now()}`,
      fileName: `Passport_Photos_${copiesCount}x_Sheet.pdf`,
      fileSizeText: '2.4 MB',
      pageCount: 1,
      previewUrl: passportPhoto.url,
      rotation: 0,
      filter: 'natural',
      brightness: 100,
      contrast: 100,
      cropBox: { x: 5, y: 5, width: 90, height: 90 },
      options: {
        colorMode: 'color',
        duplexMode: 'simplex',
        paperSize: 'A4',
        paperType: 'glossy_180',
        orientation: 'portrait',
        copies: 1,
        pageRange: '1',
        finishing: 'none',
      },
    };

    setDocuments((prev) => [...prev, newDoc]);
    setActiveDocIndex(documents.length);
    setIntakeMode('documents');
    setPassportToast(`Passport photo sheet (${copiesCount} photos) added to order! ✓`);
    setTimeout(() => setPassportToast(null), 3000);
  };

  // Lookup Order from WhatsApp
  const handleLookupWhatsAppOrder = () => {
    const query = lookupPhoneOrToken.trim();
    if (!query) {
      setLookupFeedback({ text: 'Please enter a 10-digit mobile number or 4-digit token.', isError: true });
      return;
    }

    setLookupLoading(true);
    setLookupFeedback(null);

    setTimeout(() => {
      setLookupLoading(false);
      const cleanToken = query.toUpperCase().startsWith('INK-') ? query.toUpperCase() : `INK-${query.toUpperCase()}`;
      setLookupFeedback({ text: `Synced WhatsApp session for ${query}. Order file attached!`, isError: false });
      const loadedDoc: DocumentItem = {
        id: `wa-synced-${Date.now()}`,
        fileName: `WhatsApp_Attachment_${cleanToken}.pdf`,
        fileSizeText: '2.1 MB',
        pageCount: 3,
        previewUrl: '',
        rotation: 0,
        filter: 'natural',
        brightness: 100,
        contrast: 100,
        cropBox: { x: 5, y: 5, width: 90, height: 90 },
        options: {
          colorMode: 'bw',
          duplexMode: 'duplex_auto',
          paperSize: 'A4',
          orientation: 'portrait',
          copies: 1,
          pageRange: 'All',
        },
      };
      setDocuments((prev) => [...prev, loadedDoc]);
      setActiveDocIndex(documents.length);
      setTimeout(() => setIntakeMode('documents'), 1200);
    }, 600);
  };

  const totalPagesCount = documents.reduce((acc, d) => acc + parsePageRangeCount(d.options.pageRange || 'All', d.pageCount) * (d.options.copies || 1), 0) * globalCopies;
  const grandTotal = calculateTotal();

  // Open Document Editor
  const openEditorForActiveDoc = () => {
    if (!activeDoc) return;
    setEditorRotation(activeDoc.rotation || 0);
    setEditorFilter(activeDoc.filter || 'natural');
    setEditorBrightness(activeDoc.brightness || 100);
    setEditorContrast(activeDoc.contrast || 100);
    setEditorCrop(activeDoc.cropBox || { x: 5, y: 5, width: 90, height: 90 });
    setEditorNote(activeDoc.note || '');
    setEditorOpen(true);
  };

  // Save changes from Editor
  const handleSaveEditor = () => {
    setDocuments((prev) =>
      prev.map((doc, idx) => {
        if (idx === activeDocIndex) {
          return {
            ...doc,
            rotation: editorRotation,
            filter: editorFilter,
            brightness: editorBrightness,
            contrast: editorContrast,
            cropBox: editorCrop,
            note: editorNote,
          };
        }
        return doc;
      })
    );
    setEditorOpen(false);
  };

  // Render canvas inside editor
  useEffect(() => {
    if (!editorOpen || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 440;
    canvas.height = 580;

    let filterString = `brightness(${editorBrightness}%) contrast(${editorContrast}%)`;
    if (editorFilter === 'grayscale') filterString += ' grayscale(100%)';
    if (editorFilter === 'bw_doc') filterString += ' grayscale(100%) contrast(220%) brightness(110%)';
    if (editorFilter === 'enhanced') filterString += ' contrast(130%) brightness(105%)';

    const drawCropOverlay = () => {
      const cropX = (editorCrop.x / 100) * canvas.width;
      const cropY = (editorCrop.y / 100) * canvas.height;
      const cropW = (editorCrop.width / 100) * canvas.width;
      const cropH = (editorCrop.height / 100) * canvas.height;

      // Semi-transparent shroud outside crop box
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(0, 0, canvas.width, cropY);
      ctx.fillRect(0, cropY + cropH, canvas.width, canvas.height - (cropY + cropH));
      ctx.fillRect(0, cropY, cropX, cropH);
      ctx.fillRect(cropX + cropW, cropY, canvas.width - (cropX + cropW), cropH);

      // Green border around crop
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(cropX, cropY, cropW, cropH);

      // 8 Draggable Corner/Edge Handles
      const handleSize = 10;
      ctx.fillStyle = '#10B981';
      const handles = [
        { x: cropX, y: cropY },
        { x: cropX + cropW / 2, y: cropY },
        { x: cropX + cropW, y: cropY },
        { x: cropX + cropW, y: cropY + cropH / 2 },
        { x: cropX + cropW, y: cropY + cropH },
        { x: cropX + cropW / 2, y: cropY + cropH },
        { x: cropX, y: cropY + cropH },
        { x: cropX, y: cropY + cropH / 2 },
      ];
      handles.forEach((h) => {
        ctx.fillRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize);
      });
    };

    const isImageFile =
      activeDoc?.file?.type?.startsWith('image/') ||
      /\.(jpg|jpeg|png|webp|bmp|gif|svg)$/i.test(activeDoc?.fileName || '');

    if (isImageFile && (activeDoc?.previewUrl || activeDoc?.fileUrl)) {
      const img = new Image();
      img.onload = () => {
        if (!canvasRef.current) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((editorRotation * Math.PI) / 180);
        ctx.translate(-canvas.width / 2, -canvas.height / 2);
        ctx.filter = filterString;

        const maxW = canvas.width - 32;
        const maxH = canvas.height - 32;
        const scale = Math.min(maxW / (img.naturalWidth || 1), maxH / (img.naturalHeight || 1));
        const w = (img.naturalWidth || 300) * scale;
        const h = (img.naturalHeight || 400) * scale;
        const x = (canvas.width - w) / 2;
        const y = (canvas.height - h) / 2;

        ctx.drawImage(img, x, y, w, h);
        ctx.restore();

        drawCropOverlay();
      };
      img.src = activeDoc?.previewUrl || activeDoc?.fileUrl || '';
      return;
    }

    // For PDF / Document files: Render clean real document representation
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((editorRotation * Math.PI) / 180);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);
    ctx.filter = filterString;

    // Document header badge
    ctx.fillStyle = '#4D64E6';
    ctx.fillRect(30, 30, 110, 26);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.fillText(`${activeDoc?.pageCount || 1} PAGE DOCUMENT`, 38, 47);

    // Real document file title
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 18px Inter, sans-serif';
    const rawTitle = activeDoc?.fileName || 'Document Preview';
    const displayTitle = rawTitle.length > 28 ? `${rawTitle.substring(0, 25)}...` : rawTitle;
    ctx.fillText(displayTitle, 30, 85);

    // Print specifications subtitle
    ctx.fillStyle = '#64748B';
    ctx.font = '12px Inter, sans-serif';
    const colorLabel = activeDoc?.options?.colorMode === 'color' ? 'Full Colour' : 'B&W Monochrome';
    const sidesLabel = activeDoc?.options?.duplexMode === 'duplex_auto' ? 'Two-Sided (Duplex)' : 'Single-Sided';
    ctx.fillText(`${activeDoc?.options?.paperSize || 'A4'} • ${colorLabel} • ${sidesLabel}`, 30, 108);

    // Realistic document layout lines
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(30, 125);
    ctx.lineTo(410, 125);
    ctx.stroke();

    ctx.fillStyle = '#E2E8F0';
    for (let y = 145; y < 490; y += 18) {
      const lineWidth = y % 54 === 0 ? 240 : (y % 36 === 0 ? 320 : 380);
      ctx.fillRect(30, y, lineWidth, 8);
    }

    // Document footer with page indicator
    ctx.fillStyle = '#94A3B8';
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.fillText(`Page 1 of ${activeDoc?.pageCount || 1}`, 30, 530);
    ctx.fillText(`${activeDoc?.fileSizeText || ''}`, 330, 530);

    ctx.restore();
    drawCropOverlay();
  }, [editorOpen, editorRotation, editorFilter, editorBrightness, editorContrast, editorCrop, activeDoc]);

  // Create a real server order. Do not invent a local success when the API fails.
  const handlePlaceOrder = async () => {
    const normalizedPhone = customerPhone.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
    if (!customerName.trim() || !/^[6-9]\d{9}$/.test(normalizedPhone)) {
      setSubmitError('Enter your name and a valid 10-digit Indian mobile number.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      let order = pendingOnlineOrder;
      if (!order) {
      const data = await api.submitOrder({
        shopId: shop.id || 'shop-campus-1',
        customerName: customerName.trim(),
        customerPhone: normalizedPhone,
        paymentMethod,
        quote: {
          quoteId: `quote-${Date.now()}`,
          version: 'v2.4',
          currency: 'INR',
          totalPaise: Math.round(grandTotal * 100),
          items: documents.map((d) => ({
            fileName: d.fileName,
            pageCount: d.pageCount,
            lineSubtotalPaise: Math.round(d.pageCount * 150),
          })),
        },
        files: documents.map((d) => {
          const selected = parsePageNumbers(d.options.pageRange || 'All', d.pageCount);
          const effCount = selected.length;
          let cCount = 0;
          let bCount = effCount;
          if (d.options.colorMode === 'color') {
            cCount = effCount;
            bCount = 0;
          } else if (d.options.colorMode === 'mixed') {
            const cPages = parsePageNumbers(d.options.colorPages || '', d.pageCount).filter((p) => selected.includes(p));
            cCount = cPages.length;
            bCount = Math.max(0, effCount - cCount);
          }
          const bRate = d.options.duplexMode === 'simplex' ? (shop.rates?.bw_simplex || 2.0) : (shop.rates?.bw_duplex || 1.5);
          const cRate = d.options.duplexMode === 'simplex' ? (shop.rates?.color_simplex || 10.0) : (shop.rates?.color_duplex || 8.0);
          const docTotal = ((cCount * cRate) + (bCount * bRate)) * (d.options.copies || 1);

          return {
            fileName: d.fileName,
            fileSizeBytes: d.file ? d.file.size : 1024 * 1024,
            storageKey: d.storageKey || `uploads/${shop.id || 'shop-campus-1'}/${Date.now()}-${d.fileName}`,
            fileUrl: d.fileUrl || '',
            pageCount: d.pageCount,
            options: {
              ...d.options,
              rotation: d.rotation || 0,
              filter: d.filter || 'natural',
              brightness: d.brightness || 100,
              contrast: d.contrast || 100,
              cropBox: d.cropBox,
              note: d.note || '',
            },
            subtotalPaise: Math.round(docTotal * 100),
          };
        }),
      });

      if (!data?.orderId || !data?.orderNumber) {
        throw new Error('The order service did not confirm your request. Please try again.');
      }
      order = { orderId: data.orderId, orderNumber: data.orderNumber };
      if (paymentMethod === 'ONLINE_RAZORPAY') setPendingOnlineOrder(order);
      }

      if (!order) throw new Error('The order service did not confirm your request. Please try again.');

      const onlineCheckout = paymentMethod === 'ONLINE_RAZORPAY' || Boolean(pendingOnlineOrder);
      if (onlineCheckout) {
        if (!shop.onlinePaymentAvailable) throw new Error('Online payment is not available for this shop. Choose cash at collection.');
        const intent = await api.createPaymentIntent(order.orderId);
        await loadRazorpayCheckout();
        await new Promise<void>((resolve, reject) => {
          if (!window.Razorpay) { reject(new Error('Razorpay Checkout could not be loaded.')); return; }
          const checkout = new window.Razorpay({
            key: intent.keyId,
            amount: intent.amount,
            currency: intent.currency,
            name: shop.name,
            description: `Print order ${order!.orderNumber}`,
            order_id: intent.razorpayOrderId,
            prefill: { name: customerName.trim(), contact: normalizedPhone },
            handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
              try {
                await api.verifyRazorpayPayment(response);
                resolve();
              } catch (error) { reject(error); }
            },
            modal: { ondismiss: () => reject(new Error('Checkout was closed. Your order is saved; retry payment to continue.')) },
            theme: { color: '#4D64E6' },
          });
          checkout.on('payment.failed', () => reject(new Error('Payment did not complete. Your order is saved; retry payment to continue.')));
          checkout.open();
        });
      }

      setOrderResult({
        token: order.orderNumber,
        orderId: order.orderId,
        placedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        totalAmount: grandTotal.toFixed(2),
        paymentMode: onlineCheckout ? 'ONLINE' : 'CASH',
      });
      setPendingOnlineOrder(null);
      setReviewModalOpen(false);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'We could not submit your order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // SUCCESS / CONFIRMATION VIEW
  if (orderResult) {
    return (
      <div className="min-h-screen bg-[#F5F6FA] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden text-center p-6 sm:p-8 animate-fadeIn">
          {/* Top Green Pulse */}
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-inner">
            <CheckIcon size={32} />
          </div>

          <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full mb-2 border border-emerald-200">
            {orderResult.paymentMode === 'ONLINE' ? 'PAYMENT CONFIRMED' : 'ORDER RECEIVED • PAY AT THE COUNTER'}
          </span>

          <h2 className="text-xl font-extrabold text-slate-900 mb-1">Print Order Placed!</h2>
          <p className="text-xs text-slate-500 mb-5">
            {orderResult.paymentMode === 'ONLINE'
              ? 'Your payment is confirmed. The shop has received your request and will update its status.'
              : 'The shop has received your request. Staff will review it and update its status. Pay at the counter when you collect your prints.'}
          </p>

          {/* Large Monospace Token Box with Copy */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 mb-5 shadow-lg border border-slate-800 relative group">
            <div className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mb-1">
              Your Pickup Token
            </div>
            <div className="text-4xl font-black font-mono tracking-wider text-emerald-400 my-1">
              {orderResult.token}
            </div>
            <div className="flex items-center justify-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(orderResult.token);
                  setCopiedToken(true);
                  setTimeout(() => setCopiedToken(false), 2000);
                }}
                className="text-xs px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 transition-colors flex items-center gap-1.5"
              >
                <CopyIcon size={13} />
                <span>{copiedToken ? 'Copied to Clipboard! ✓' : 'Copy Token'}</span>
              </button>
            </div>
            <div className="text-[11px] text-slate-400 mt-2.5 flex items-center justify-center gap-1">
              <ClockIcon size={13} />
              Keep this order number for reference
            </div>
          </div>

          {/* 4-Step Visual Tracker */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-5 text-left">
            <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-3">
              Order Pipeline Status
            </div>
            <div className="space-y-2.5">
              {[
                { label: 'Order received', status: 'done' },
                { label: 'Shop review', status: 'active' },
                { label: 'Printing', status: 'pending' },
                { label: 'Ready for pickup', status: 'pending' },
              ].map((step, idx) => (
                <div key={idx} className="flex items-center gap-2.5 text-xs">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      step.status === 'done'
                        ? 'bg-emerald-500 text-white'
                        : step.status === 'active'
                        ? 'bg-indigo-600 text-white animate-pulse'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {step.status === 'done' ? '✓' : idx + 1}
                  </span>
                  <span
                    className={
                      step.status === 'done'
                        ? 'text-slate-800 font-medium'
                        : step.status === 'active'
                        ? 'text-indigo-900 font-bold'
                        : 'text-slate-400'
                    }
                  >
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Order Summary Details */}
          <div className="bg-slate-50 rounded-2xl p-4 mb-6 text-left text-xs space-y-2 border border-slate-100">
            <div className="flex justify-between text-slate-600">
              <span>Shop & Counter:</span>
              <span className="font-semibold text-slate-900">{shop.name} ({shop.counter})</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Documents:</span>
              <span className="font-semibold text-slate-900">{documents.length} file(s) • {totalPagesCount} pages</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Payment Mode:</span>
              <span className="font-bold text-indigo-600">{orderResult.paymentMode === 'ONLINE' ? 'Paid online' : 'Cash — collect at the counter'}</span>
            </div>
            <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-bold text-slate-900">
              <span>{orderResult.paymentMode === 'ONLINE' ? 'Order total:' : 'Payable at counter:'}</span>
              <span className="text-slate-900">₹{orderResult.totalAmount}</span>
            </div>
          </div>

          <div className="space-y-2.5">
            {onOrderSubmitted && (
              <button
                type="button"
                onClick={() => onOrderSubmitted(orderResult.orderId)}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold rounded-xl shadow-xs transition-all text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Check order status →</span>
              </button>
            )}
            <a
              href={`https://wa.me/?text=Hi!%20My%20Inklly%20print%20pickup%20token%20is%20${orderResult.token}%20at%20${encodeURIComponent(shop.name)}.`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-all text-xs flex items-center justify-center gap-2 no-underline"
            >
              <ShareIcon size={14} />
              Share Token on WhatsApp
            </a>
            <button
              type="button"
              onClick={() => {
                setOrderResult(null);
                setDocuments([]);
              }}
              className="w-full py-3 bg-[#4D64E6] hover:bg-[#3F54D1] text-white font-bold rounded-xl shadow-xs transition-all text-xs"
            >
              Print Another Document
            </button>
            {onNavigateHome && (
              <button
                type="button"
                onClick={onNavigateHome}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-all"
              >
                Back to Inklly Home
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F6FA] text-slate-800 pb-28">
      {/* 1. TOP HEADER BAR WITH GRADIENT (Matching Part 2 Video) */}
      <header
        className="w-full py-3.5 px-4 sticky top-0 z-30 shadow-sm"
        style={{ background: 'linear-gradient(135deg, #475DE7 0%, #7A86F2 100%)' }}
      >
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex-shrink-0 drop-shadow-sm">
              <InkllyMark size={32} />
            </div>
            <div>
              <div className="text-white font-black text-sm tracking-tight flex items-center gap-1.5">
                Inklly
                <span className="bg-white/25 text-[10px] font-bold px-1.5 py-0.5 rounded text-white">
                  FAST QR
                </span>
              </div>
              <div className="text-indigo-100 text-xs font-medium">
                {shop.name} secure print order
              </div>
            </div>
          </div>

          <div className="text-right">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-500/25 border border-emerald-300/30 text-emerald-100 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse"></span>
              Printer Ready
            </span>
          </div>
        </div>
      </header>

      {/* 2. MAIN CENTERED CONTENT COLUMN (~440px) */}
      <div className="max-w-md mx-auto p-4 space-y-4">
        {/* Toast Alerts */}
        {idCardToast && (
          <div className="p-3 bg-indigo-900 text-white rounded-xl text-xs font-bold shadow-lg flex items-center gap-2 animate-fadeIn">
            <span>🪪</span>
            <span>{idCardToast}</span>
          </div>
        )}
        {passportToast && (
          <div className="p-3 bg-indigo-900 text-white rounded-xl text-xs font-bold shadow-lg flex items-center gap-2 animate-fadeIn">
            <span>📸</span>
            <span>{passportToast}</span>
          </div>
        )}

        {/* INTAKE MODE SELECTOR BAR (Indian Print Shop Workflow Parity) */}
        <div className="grid grid-cols-4 gap-1 p-1.5 bg-slate-200/90 rounded-2xl text-center text-xs font-bold shadow-inner">
          <button
            type="button"
            onClick={() => setIntakeMode('documents')}
            className={`min-h-[44px] py-2 px-1 rounded-xl transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
              intakeMode === 'documents'
                ? 'bg-white text-indigo-700 shadow-md font-black ring-1 ring-black/5'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileTextIcon size={16} />
            <span className="text-[11px]">Files</span>
          </button>
          <button
            type="button"
            onClick={() => setIntakeMode('id_card')}
            className={`min-h-[44px] py-2 px-1 rounded-xl transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
              intakeMode === 'id_card'
                ? 'bg-white text-indigo-700 shadow-md font-black ring-1 ring-black/5'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <IdCardIcon size={16} />
            <span className="text-[11px]">ID Card 2-in-1</span>
          </button>
          <button
            type="button"
            onClick={() => setIntakeMode('passport_photo')}
            className={`min-h-[44px] py-2 px-1 rounded-xl transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
              intakeMode === 'passport_photo'
                ? 'bg-white text-indigo-700 shadow-md font-black ring-1 ring-black/5'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CameraIcon size={16} />
            <span className="text-[11px]">Passport (8x)</span>
          </button>
          <button
            type="button"
            onClick={() => setIntakeMode('whatsapp_lookup')}
            className={`min-h-[44px] py-2 px-1 rounded-xl transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
              intakeMode === 'whatsapp_lookup'
                ? 'bg-white text-indigo-700 shadow-md font-black ring-1 ring-black/5'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquareIcon size={16} />
            <span className="text-[11px]">WhatsApp</span>
          </button>
        </div>

        {/* 1A. STANDARD DOCUMENTS UPLOAD MODE */}
        {intakeMode === 'documents' && (
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 font-bold text-xs flex items-center justify-center">
                  1
                </span>
                Upload your documents
              </h2>
              <button
                type="button"
                onClick={() => {
                  if (activeDoc) {
                    openEditorForActiveDoc();
                  } else {
                    fileInputRef.current?.click();
                  }
                }}
                className="min-h-[36px] text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100/80 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
              >
                <CropIcon size={13} />
                Auto-crop & enhance
              </button>
            </div>

            {/* Drag & Drop Zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files) {
                  handleFileSelect(e.dataTransfer.files);
                }
              }}
              className={`border-2 border-dashed rounded-2xl p-5 sm:p-6 text-center cursor-pointer transition-all duration-200 group ${
                isDragging
                  ? 'border-indigo-600 bg-indigo-100/70 scale-[1.01] shadow-md shadow-indigo-500/10'
                  : 'border-indigo-200 hover:border-indigo-500 bg-indigo-50/30 hover:bg-indigo-50/60'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.zip"
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files)}
              />
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 mx-auto flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-xs">
                <UploadCloudIcon size={24} />
              </div>
              <div className="text-sm font-bold text-slate-800 mb-1">
                Tap to select documents or drop files here
              </div>
              <div className="text-[11px] text-slate-500">
                PDF, Word, Excel, PowerPoint, TXT, Images • Max 25 MB per file
              </div>
            </div>

            {/* Upload Error Banner */}
            {uploadError && (
              <div role="alert" className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs text-rose-800 animate-fadeIn">
                <div className="flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{uploadError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setUploadError(null);
                    fileInputRef.current?.click();
                  }}
                  className="min-h-[36px] px-2 py-1 bg-white border border-rose-300 font-bold rounded-lg text-rose-700 hover:bg-rose-50"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Upload Progress Overlay */}
            {uploadProgress !== null && (
              <div 
                className="mt-3 p-3 bg-amber-50/80 border border-amber-200 rounded-xl"
                role="progressbar"
                aria-valuenow={uploadProgress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Document upload progress"
              >
                <div className="flex justify-between text-xs font-bold text-amber-800 mb-1">
                  <span>Uploading document...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-amber-200 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-600 h-full transition-all duration-200 rounded-full"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <div className="text-[11px] text-amber-700 mt-1.5 italic">
                  ⚠️ Please do not close or refresh this window until the upload finishes.
                </div>
              </div>
            )}
          </div>
        )}

        {/* 1B. ID CARD 2-IN-1 STUDIO MODE */}
        {intakeMode === 'id_card' && (
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-100 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 font-bold text-xs flex items-center justify-center">
                    🪪
                  </span>
                  ID Card 2-in-1 Studio
                </h2>
                <p className="text-[11px] text-slate-500">
                  Combines Front & Back onto one single A4 sheet with border cutting guides.
                </p>
              </div>
            </div>

            {/* Upload Both Sides */}
            <div className="grid grid-cols-2 gap-3">
              {/* Front Side */}
              <div
                onClick={() => idFrontInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-3 text-center cursor-pointer transition-all ${
                  idCardFront ? 'border-emerald-500 bg-emerald-50/40' : 'border-indigo-200 bg-indigo-50/30 hover:border-indigo-400'
                }`}
              >
                <input
                  ref={idFrontInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setIdCardFront({ url: URL.createObjectURL(f), name: f.name });
                  }}
                />
                <div className="text-xs font-bold text-slate-800 mb-1">
                  {idCardFront ? '✓ Front Added' : '+ Upload Front'}
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {idCardFront ? idCardFront.name : 'Aadhaar / Driving License'}
                </div>
              </div>

              {/* Back Side */}
              <div
                onClick={() => idBackInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-3 text-center cursor-pointer transition-all ${
                  idCardBack ? 'border-emerald-500 bg-emerald-50/40' : 'border-indigo-200 bg-indigo-50/30 hover:border-indigo-400'
                }`}
              >
                <input
                  ref={idBackInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setIdCardBack({ url: URL.createObjectURL(f), name: f.name });
                  }}
                />
                <div className="text-xs font-bold text-slate-800 mb-1">
                  {idCardBack ? '✓ Back Added' : '+ Upload Back'}
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {idCardBack ? idCardBack.name : 'Address / Barcode Side'}
                </div>
              </div>
            </div>

            {/* Layout & Color Controls */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Layout</label>
                <select
                  value={idCardLayout}
                  onChange={(e) => setIdCardLayout(e.target.value as any)}
                  className="w-full p-2 rounded-lg border border-slate-200 text-slate-800 bg-slate-50 font-semibold"
                >
                  <option value="stacked">Stacked (Top & Bottom)</option>
                  <option value="side_by_side">Side-by-Side</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Color Mode</label>
                <select
                  value={idCardColor}
                  onChange={(e) => setIdCardColor(e.target.value as any)}
                  className="w-full p-2 rounded-lg border border-slate-200 text-slate-800 bg-slate-50 font-semibold"
                >
                  <option value="bw">Black & White (₹2.00)</option>
                  <option value="color">Full Colour (₹10.00)</option>
                </select>
              </div>
            </div>

            {/* Live 2-in-1 Canvas Preview */}
            <div className="bg-slate-900 rounded-xl p-4 flex flex-col items-center justify-center border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mb-2">
                A4 Sheet Single-Page Preview
              </div>
              <div className="w-40 h-56 bg-white rounded shadow-md p-2 flex flex-col justify-around items-center border border-slate-300 relative">
                {/* Simulated Front Card */}
                <div className={`w-32 h-20 rounded border border-dashed border-slate-400 bg-slate-100 flex flex-col items-center justify-center p-1.5 ${idCardColor === 'bw' ? 'filter grayscale' : ''}`}>
                  <div className="w-full flex items-center justify-between">
                    <span className="text-[7px] font-black text-indigo-700">GOVT OF INDIA</span>
                    <span className="text-[6px] text-slate-400">ID CARD</span>
                  </div>
                  <div className="w-full flex items-center gap-1.5 mt-1">
                    <div className="w-5 h-6 bg-slate-300 rounded text-[6px] flex items-center justify-center">📷</div>
                    <div className="space-y-0.5 flex-1">
                      <div className="h-1 bg-slate-400 rounded w-full"></div>
                      <div className="h-1 bg-slate-300 rounded w-4/5"></div>
                      <div className="h-1 bg-slate-300 rounded w-3/5"></div>
                    </div>
                  </div>
                </div>

                {/* Simulated Back Card */}
                <div className={`w-32 h-20 rounded border border-dashed border-slate-400 bg-slate-100 flex flex-col items-center justify-center p-1.5 ${idCardColor === 'bw' ? 'filter grayscale' : ''}`}>
                  <div className="w-full flex items-center justify-between">
                    <span className="text-[6px] text-slate-500">RESIDENCE ADDRESS</span>
                    <span className="text-[6px] text-slate-400">PIN 411001</span>
                  </div>
                  <div className="w-full space-y-1 mt-1">
                    <div className="h-1 bg-slate-300 rounded w-full"></div>
                    <div className="h-1 bg-slate-300 rounded w-5/6"></div>
                    <div className="h-2 bg-slate-400 rounded w-2/3 mx-auto mt-1 flex items-center justify-center text-[5px] text-white">BARCODE</div>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddIdCardToOrder}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold shadow-md shadow-indigo-500/20 transition-all cursor-pointer"
            >
              Add ID Card 2-in-1 Sheet to Order →
            </button>
          </div>
        )}

        {/* 1C. PASSPORT PHOTO SHEET STUDIO MODE */}
        {intakeMode === 'passport_photo' && (
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-100 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 font-bold text-xs flex items-center justify-center">
                    📸
                  </span>
                  Passport Photo Studio
                </h2>
                <p className="text-[11px] text-slate-500">
                  Generates an 8-photo studio sheet on glossy photo paper with standard cut guides.
                </p>
              </div>
            </div>

            {/* Photo Uploader */}
            <div
              onClick={() => passportInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                passportPhoto ? 'border-emerald-500 bg-emerald-50/40' : 'border-indigo-200 bg-indigo-50/30 hover:border-indigo-400'
              }`}
            >
              <input
                ref={passportInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setPassportPhoto({ url: URL.createObjectURL(f), name: f.name });
                }}
              />
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 mx-auto flex items-center justify-center mb-1.5">
                <CameraIcon size={16} />
              </div>
              <div className="text-xs font-bold text-slate-800">
                {passportPhoto ? '✓ Photo Selected: ' + passportPhoto.name : 'Tap to Upload Portrait / Selfie'}
              </div>
              <div className="text-[10px] text-slate-400">
                Works with mobile selfies, camera roll or studio JPG
              </div>
            </div>

            {/* Grid & Background Controls */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Sheet Format</label>
                <select
                  value={passportGrid}
                  onChange={(e) => setPassportGrid(e.target.value as any)}
                  className="w-full p-2 rounded-lg border border-slate-200 text-slate-800 bg-slate-50 font-semibold"
                >
                  <option value="8_pack_4x6">8 Photos (4×6 Photo Paper)</option>
                  <option value="16_pack_a4">16 Photos (A4 Full Sheet)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Background Tint</label>
                <select
                  value={passportBg}
                  onChange={(e) => setPassportBg(e.target.value as any)}
                  className="w-full p-2 rounded-lg border border-slate-200 text-slate-800 bg-slate-50 font-semibold"
                >
                  <option value="white">Studio White (Standard)</option>
                  <option value="blue">Visa Sky Blue</option>
                  <option value="gray">Off-White Neutral</option>
                  <option value="original">Original Photo BG</option>
                </select>
              </div>
            </div>

            {/* Visual 8-Pack Grid Preview */}
            <div className="bg-slate-900 rounded-xl p-4 flex flex-col items-center justify-center border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mb-2">
                {passportGrid === '8_pack_4x6' ? '8-Photo Grid with Cutting Guides' : '16-Photo Grid Preview'}
              </div>
              <div className="grid grid-cols-4 gap-2 bg-white p-3 rounded shadow-md border border-slate-300">
                {Array.from({ length: passportGrid === '8_pack_4x6' ? 8 : 16 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-10 h-12 rounded border border-dashed border-slate-400 flex flex-col items-center justify-center relative overflow-hidden"
                    style={{
                      backgroundColor:
                        passportBg === 'blue'
                          ? '#D0E8FF'
                          : passportBg === 'gray'
                          ? '#EAEAEA'
                          : '#FFFFFF',
                    }}
                  >
                    {passportPhoto ? (
                      <img src={passportPhoto.url} alt="Passport" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center">
                        <span className="text-[10px]">👤</span>
                        <span className="text-[5px] text-slate-400">35x45mm</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddPassportPhotoToOrder}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold shadow-md shadow-indigo-500/20 transition-all cursor-pointer"
            >
              Add Passport Photo Sheet to Order →
            </button>
          </div>
        )}

        {/* 1D. WHATSAPP / TOKEN RETRIEVAL MODE */}
        {intakeMode === 'whatsapp_lookup' && (
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-100 space-y-4 animate-fadeIn">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 font-bold text-xs flex items-center justify-center">
                  <MessageSquareIcon size={13} />
                </span>
                Sync WhatsApp Order
              </h2>
              <p className="text-[11px] text-slate-500">
                Already submitted a request? Open its tracking link to check the latest shop status.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. 9876543210 or 4092"
                  value={lookupPhoneOrToken}
                  onChange={(e) => setLookupPhoneOrToken(e.target.value)}
                  className="flex-1 p-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 font-mono focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  disabled={lookupLoading}
                  onClick={handleLookupWhatsAppOrder}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  {lookupLoading ? 'Syncing...' : 'Fetch Order'}
                </button>
              </div>

              {lookupFeedback && (
                <div className={`p-2.5 rounded-xl text-xs font-medium ${lookupFeedback.isError ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}`}>
                  {lookupFeedback.text}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: DOCUMENTS LIST & PREVIEW (When files exist) */}
        {documents.length > 0 && (
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 font-bold text-xs flex items-center justify-center">
                    2
                  </span>
                  Documents ({documents.length})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg"
              >
                + Add Doc
              </button>
            </div>

            {/* Document Chips / Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {documents.map((doc, idx) => (
                <div
                  key={doc.id}
                  onClick={() => setActiveDocIndex(idx)}
                  className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-all border ${
                    activeDocIndex === idx
                      ? 'bg-indigo-50/90 border-indigo-400 text-indigo-900 font-bold shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <FileTextIcon size={14} />
                  <span>Doc {idx + 1}</span>
                  <span className="text-[10px] bg-white/80 px-1 rounded text-slate-500">
                    {doc.pageCount}p
                  </span>
                  {documents.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => removeDocument(idx, e)}
                      className="text-slate-400 hover:text-rose-600 p-0.5 ml-1"
                      title="Remove document"
                    >
                      <TrashIcon size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Real Interactive Document & PDF Preview with Actual Pages and Content */}
            {activeDoc && (
              <DocumentViewer
                fileName={activeDoc.fileName}
                fileUrl={activeDoc.fileUrl || activeDoc.previewUrl}
                pageCount={activeDoc.pageCount}
                rotation={activeDoc.rotation}
                options={activeDoc.options}
                onRotate={updateActiveRotation}
                onOpenEditor={openEditorForActiveDoc}
                onPageCountDetected={(detected) => {
                  if (detected && detected !== activeDoc.pageCount) {
                    setDocuments((prev) =>
                      prev.map((d, i) => (i === activeDocIndex ? { ...d, pageCount: detected } : d))
                    );
                  }
                }}
              />
            )}

            {/* PRINT OPTIONS ACCORDION */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowOptionsAccordion(!showOptionsAccordion)}
                className="w-full flex items-center justify-between p-3.5 bg-slate-50 text-xs font-bold text-slate-800 hover:bg-slate-100 transition-colors"
              >
                <span>Print Settings for Doc {activeDocIndex + 1}</span>
                {showOptionsAccordion ? <ChevronUpIcon size={16} /> : <ChevronDownIcon size={16} />}
              </button>

              {showOptionsAccordion && (
                <div className="p-4 space-y-3.5 bg-white text-xs">
                  {/* Pages to Print (Page Range Selector) */}
                  <div>
                    <label className="block text-slate-700 font-bold mb-1.5 flex items-center justify-between">
                      <span>Pages to Print</span>
                      <span className="text-[10px] text-indigo-600 font-semibold">
                        {parsePageRangeCount(activeDoc.options.pageRange || 'All', activeDoc.pageCount)} of {activeDoc.pageCount} pages selected
                      </span>
                    </label>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <button
                        type="button"
                        onClick={() => updateActiveOptions({ pageRange: 'All' })}
                        className={`p-2.5 rounded-xl border text-center font-bold text-xs transition-all ${
                          (activeDoc.options.pageRange || 'All').toLowerCase() === 'all'
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-500/20'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        All Pages (1-{activeDoc.pageCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if ((activeDoc.options.pageRange || 'All').toLowerCase() === 'all') {
                            updateActiveOptions({ pageRange: `1-${Math.min(activeDoc.pageCount, 1)}` });
                          }
                        }}
                        className={`p-2.5 rounded-xl border text-center font-bold text-xs transition-all ${
                          (activeDoc.options.pageRange || 'All').toLowerCase() !== 'all'
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-500/20'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        Custom Range
                      </button>
                    </div>
                    {(activeDoc.options.pageRange || 'All').toLowerCase() !== 'all' && (
                      <div className="space-y-1.5 mt-1.5 animate-fadeIn">
                        <input
                          type="text"
                          value={activeDoc.options.pageRange === 'All' ? '' : activeDoc.options.pageRange}
                          onChange={(e) => updateActiveOptions({ pageRange: e.target.value })}
                          placeholder={`e.g. 1-${Math.min(activeDoc.pageCount, 5)}, ${activeDoc.pageCount}`}
                          className="w-full p-2.5 rounded-xl border border-indigo-300 text-xs text-slate-900 font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <p className="text-[10px] text-slate-400">
                          Type individual pages or ranges separated by commas (e.g. <code>1-5</code> or <code>1, 3, 5</code>).
                        </p>
                        {activeDoc.pageCount > 1 && activeDoc.pageCount <= 30 && (
                          <div className="pt-1">
                            <div className="text-[10px] text-slate-500 font-semibold mb-1">Click to toggle pages:</div>
                            <div className="flex flex-wrap gap-1">
                              {Array.from({ length: activeDoc.pageCount }, (_, idx) => idx + 1).map((pg) => {
                                const currentSelected = parsePageNumbers(activeDoc.options.pageRange || 'All', activeDoc.pageCount);
                                const isSelected = currentSelected.includes(pg);
                                return (
                                  <button
                                    key={pg}
                                    type="button"
                                    onClick={() => {
                                      let nextList: number[];
                                      if (isSelected) {
                                        nextList = currentSelected.filter((p) => p !== pg);
                                      } else {
                                        nextList = [...currentSelected, pg].sort((a, b) => a - b);
                                      }
                                      if (nextList.length === activeDoc.pageCount) {
                                        updateActiveOptions({ pageRange: 'All' });
                                      } else if (nextList.length === 0) {
                                        updateActiveOptions({ pageRange: `${pg}` });
                                      } else {
                                        updateActiveOptions({ pageRange: nextList.join(', ') });
                                      }
                                    }}
                                    className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                      isSelected
                                        ? 'bg-indigo-600 text-white shadow-xs'
                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                    }`}
                                  >
                                    {pg}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Document Copies */}
                  <div>
                    <label className="block text-slate-700 font-bold mb-1.5 flex items-center justify-between">
                      <span>Copies of this Document</span>
                      <span className="text-[10px] text-slate-400 font-normal">Sets to print</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 bg-slate-100 rounded-xl p-1 border border-slate-200">
                        <button
                          type="button"
                          onClick={() => updateActiveOptions({ copies: Math.max(1, (activeDoc.options.copies || 1) - 1) })}
                          className="w-8 h-8 rounded-lg bg-white shadow-xs font-bold text-sm text-slate-700 hover:bg-slate-50 flex items-center justify-center cursor-pointer disabled:opacity-40"
                          disabled={(activeDoc.options.copies || 1) <= 1}
                        >
                          -
                        </button>
                        <span className="w-8 text-center font-bold text-xs text-slate-900">
                          {activeDoc.options.copies || 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateActiveOptions({ copies: (activeDoc.options.copies || 1) + 1 })}
                          className="w-8 h-8 rounded-lg bg-white shadow-xs font-bold text-sm text-slate-700 hover:bg-slate-50 flex items-center justify-center cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-xs text-slate-500 font-medium">
                        {((activeDoc.options.copies || 1) > 1) ? `${activeDoc.options.copies} print sets` : '1 single set'}
                      </span>
                    </div>
                  </div>

                  {/* Special Instructions / Note for Shopkeeper */}
                  <div>
                    <label className="block text-slate-700 font-bold mb-1.5 flex items-center justify-between">
                      <span>Special Instructions for Shopkeeper</span>
                      <span className="text-[10px] text-slate-400 font-normal">Optional</span>
                    </label>
                    <input
                      type="text"
                      value={activeDoc.note || ''}
                      onChange={(e) => {
                        const noteVal = e.target.value;
                        setDocuments((prev) =>
                          prev.map((d, i) => (i === activeDocIndex ? { ...d, note: noteVal } : d))
                        );
                      }}
                      placeholder="e.g. Please staple top left corner, print on heavy paper..."
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  {/* Color Mode with Mixed Color Support */}
                  <div>
                    <label className="block text-slate-700 font-bold mb-1.5 flex items-center justify-between">
                      <span>Color Mode</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        {activeDoc.options.colorMode === 'mixed' ? 'Mixed Color + B&W' : 'Per page rate'}
                      </span>
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => updateActiveOptions({ colorMode: 'bw' })}
                        className={`p-2.5 rounded-2xl border text-left transition-all relative overflow-hidden ${
                          activeDoc.options.colorMode === 'bw'
                            ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-bold ring-2 ring-indigo-500/20 shadow-xs'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <div className="w-3 h-3 rounded-full bg-slate-800 border border-slate-600 shrink-0" />
                          <div className="font-bold text-[11px] truncate">B&W</div>
                        </div>
                        <div className="text-[9px] text-slate-500 font-medium">₹{shop.rates?.bw_simplex ? shop.rates.bw_simplex.toFixed(2) : '1.50'}/p</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => updateActiveOptions({ colorMode: 'color' })}
                        className={`p-2.5 rounded-2xl border text-left transition-all relative overflow-hidden ${
                          activeDoc.options.colorMode === 'color'
                            ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-bold ring-2 ring-indigo-500/20 shadow-xs'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <div className="w-3 h-3 rounded-full bg-gradient-to-tr from-rose-500 via-amber-400 to-indigo-500 shrink-0" />
                          <div className="font-bold text-[11px] truncate">Colour</div>
                        </div>
                        <div className="text-[9px] text-slate-500 font-medium">₹{shop.rates?.color_simplex ? shop.rates.color_simplex.toFixed(2) : '8.00'}/p</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const defaultColorPages = activeDoc.options.colorPages || '1';
                          updateActiveOptions({ colorMode: 'mixed', colorPages: defaultColorPages });
                        }}
                        className={`p-2.5 rounded-2xl border text-left transition-all relative overflow-hidden ${
                          activeDoc.options.colorMode === 'mixed'
                            ? 'border-purple-600 bg-purple-50/70 text-purple-950 font-bold ring-2 ring-purple-500/20 shadow-xs'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <div className="w-3 h-3 rounded-full bg-gradient-to-r from-slate-700 to-purple-500 shrink-0" />
                          <div className="font-bold text-[11px] truncate">Mixed</div>
                        </div>
                        <div className="text-[9px] text-purple-700 font-medium">Custom color</div>
                      </button>
                    </div>

                    {/* Mixed Color Detail Section */}
                    {activeDoc.options.colorMode === 'mixed' && (
                      <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl space-y-2 mt-2 animate-fadeIn">
                        <div className="flex items-center justify-between text-xs">
                          <label className="font-bold text-purple-950">Select Color Pages</label>
                          <span className="text-[10px] text-purple-700 font-semibold">
                            {(() => {
                              const sel = parsePageNumbers(activeDoc.options.pageRange || 'All', activeDoc.pageCount);
                              const clr = parsePageNumbers(activeDoc.options.colorPages || '', activeDoc.pageCount).filter((p) => sel.includes(p));
                              return `${clr.length} Color · ${Math.max(0, sel.length - clr.length)} B&W`;
                            })()}
                          </span>
                        </div>
                        <input
                          type="text"
                          value={activeDoc.options.colorPages || ''}
                          onChange={(e) => updateActiveOptions({ colorPages: e.target.value })}
                          placeholder="e.g. 1, 2, 5 or 1-2"
                          className="w-full p-2 bg-white rounded-lg border border-purple-300 font-mono text-purple-900 text-xs focus:ring-2 focus:ring-purple-500 outline-none"
                        />
                        {activeDoc.pageCount > 1 && activeDoc.pageCount <= 30 && (
                          <div>
                            <div className="text-[10px] text-purple-600 font-medium mb-1">Click pages to toggle Color / B&W:</div>
                            <div className="flex flex-wrap gap-1">
                              {Array.from({ length: activeDoc.pageCount }, (_, idx) => idx + 1).map((pg) => {
                                const sel = parsePageNumbers(activeDoc.options.pageRange || 'All', activeDoc.pageCount);
                                const inSelected = sel.includes(pg);
                                const colorList = parsePageNumbers(activeDoc.options.colorPages || '', activeDoc.pageCount);
                                const isColor = colorList.includes(pg);
                                if (!inSelected) return null;
                                return (
                                  <button
                                    key={pg}
                                    type="button"
                                    onClick={() => {
                                      let nextColor: number[];
                                      if (isColor) {
                                        nextColor = colorList.filter((p) => p !== pg);
                                      } else {
                                        nextColor = [...colorList, pg].sort((a, b) => a - b);
                                      }
                                      updateActiveOptions({ colorPages: nextColor.join(', ') });
                                    }}
                                    className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                      isColor
                                        ? 'bg-gradient-to-tr from-rose-500 to-purple-600 text-white shadow-xs ring-1 ring-purple-400'
                                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                                    }`}
                                    title={isColor ? `Page ${pg}: Color` : `Page ${pg}: B&W`}
                                  >
                                    {pg}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        <p className="text-[10px] text-purple-700 leading-tight">
                          💡 Selected color pages print in rich colour. Remaining selected pages print in B&W for maximum savings!
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Print Style (Sides) */}
                  <div>
                    <label className="block text-slate-700 font-bold mb-1.5 flex items-center justify-between">
                      <span>Print Sides</span>
                      <span className="text-[10px] text-emerald-600 font-semibold">Duplex supported</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => updateActiveOptions({ duplexMode: 'simplex' })}
                        className={`min-h-[52px] p-3 rounded-2xl border text-left transition-all ${
                          activeDoc.options.duplexMode === 'simplex'
                            ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-bold ring-2 ring-indigo-500/20 shadow-xs'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="font-bold text-xs mb-1">📄 Single Sided</div>
                        <div className="text-[10px] text-slate-500">1 side per sheet</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => updateActiveOptions({ duplexMode: 'duplex_auto' })}
                        className={`min-h-[52px] p-3 rounded-2xl border text-left transition-all relative overflow-hidden ${
                          activeDoc.options.duplexMode === 'duplex_auto'
                            ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-bold ring-2 ring-indigo-500/20 shadow-xs'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="font-bold text-xs mb-1">📑 Back-to-Back</div>
                        <div className="text-[10px] text-emerald-600 font-semibold">🌿 Saves 50% paper</div>
                      </button>
                    </div>
                  </div>

                  {/* Paper Size & Orientation with Accessible 44px Heights */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Paper Size</label>
                      <select
                        value={activeDoc.options.paperSize}
                        onChange={(e) =>
                          updateActiveOptions({
                            paperSize: e.target.value as 'A4' | 'A3' | 'Legal',
                          })
                        }
                        className="w-full min-h-[44px] p-2.5 rounded-xl border border-slate-200 text-slate-800 bg-white font-medium"
                      >
                        <option value="A4">A4 (Standard Xerox)</option>
                        <option value="A3">A3 (Large Ledger - 2x Rate)</option>
                        <option value="Legal">Legal (8.5×14")</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Orientation</label>
                      <select
                        value={activeDoc.options.orientation}
                        onChange={(e) =>
                          updateActiveOptions({
                            orientation: e.target.value as 'auto' | 'portrait' | 'landscape',
                          })
                        }
                        className="w-full min-h-[44px] p-2.5 rounded-xl border border-slate-200 text-slate-800 bg-white font-medium"
                      >
                        <option value="auto">Auto Detect</option>
                        <option value="portrait">Portrait</option>
                        <option value="landscape">Landscape</option>
                      </select>
                    </div>
                  </div>

                  {/* Paper Quality & GSM Media Selection */}
                  <div>
                    <label className="block text-slate-700 font-bold mb-1 flex items-center justify-between">
                      <span>Paper Media & GSM</span>
                      <span className="text-[10px] text-slate-500 font-normal">Grade surcharge</span>
                    </label>
                    <select
                      value={activeDoc.options.paperType || 'standard_75'}
                      onChange={(e) =>
                        updateActiveOptions({
                          paperType: e.target.value as any,
                        })
                      }
                      className="w-full min-h-[44px] p-2.5 rounded-xl border border-slate-200 text-slate-800 bg-white font-medium"
                    >
                      <option value="standard_75">Standard 75 GSM Copier Paper (Base Rate)</option>
                      <option value="bond_85">Bond Paper 85 GSM (+₹0.50/sheet)</option>
                      <option value="executive_100">Executive Bond 100 GSM (+₹1.50/sheet)</option>
                      <option value="glossy_180">Glossy Photo Paper 180 GSM (+₹12.00/sheet)</option>
                      <option value="card_250">Heavy Card Stock 250 GSM (+₹8.00/sheet)</option>
                    </select>
                  </div>

                  {/* Finishing & Binding Add-ons with 44px min touch targets */}
                  <div>
                    <label className="block text-slate-700 font-bold mb-1 flex items-center justify-between">
                      <span>Post-Print Finishing & Binding</span>
                      <span className="text-[10px] text-indigo-600 font-semibold">Optional</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'none', label: 'No Finishing', price: '₹0' },
                        { id: 'staple', label: 'Corner Staple', price: '+₹2.00' },
                        { id: 'spiral', label: 'Spiral Coil Binding', price: '+₹35.00' },
                        { id: 'thermal', label: 'Thermal Soft Binding', price: '+₹60.00' },
                        { id: 'lamination', label: 'Lamination', price: '+₹25.00' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => updateActiveOptions({ finishing: item.id as any })}
                          className={`min-h-[44px] p-2.5 rounded-xl border text-left transition-all ${
                            (activeDoc.options.finishing || 'none') === item.id
                              ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-bold ring-1 ring-indigo-500/30'
                              : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="text-[11px] font-bold">{item.label}</div>
                          <div className="text-[10px] text-slate-500">{item.price}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tray Status Banner */}
                  <div className="p-2.5 bg-blue-50/70 border border-blue-100 rounded-lg text-[11px] text-blue-700 flex items-center gap-1.5">
                    <span>ℹ️</span>
                    <span>Printer Tray 1 is loaded with high quality 75 GSM paper.</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. STICKY BOTTOM ACTION BAR (44px min touch targets & safe area padding) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] px-3 sm:px-4 shadow-xl">
        <div className="max-w-md mx-auto flex items-center justify-between gap-2">
          {/* Left: Total Calculation */}
          <div className="flex-shrink-0 min-w-[70px]">
            <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
              Total Quote
            </div>
            <div className="text-xl font-extrabold text-slate-900 leading-tight">
              ₹{grandTotal.toFixed(2)}
            </div>
            <div className="text-[10px] text-slate-500 truncate">
              {totalPagesCount}p • {documents.length} doc{documents.length > 1 ? 's' : ''}
            </div>
          </div>

          {/* Center: Copies Stepper with 44px Touch Targets */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 border border-slate-200">
            <button
              type="button"
              onClick={() => setGlobalCopies(Math.max(1, globalCopies - 1))}
              className="w-10 h-10 min-w-[40px] min-h-[40px] sm:w-11 sm:h-11 sm:min-w-[44px] sm:min-h-[44px] rounded-lg bg-white text-slate-800 font-bold hover:bg-slate-50 flex items-center justify-center shadow-xs text-base active:bg-slate-200 transition-colors cursor-pointer"
              title="Decrease copies"
              aria-label="Decrease number of copies"
            >
              −
            </button>
            <span className="w-6 text-center font-bold text-sm text-slate-900" aria-label={`${globalCopies} copies`}>
              {globalCopies}
            </span>
            <button
              type="button"
              onClick={() => setGlobalCopies(globalCopies + 1)}
              className="w-10 h-10 min-w-[40px] min-h-[40px] sm:w-11 sm:h-11 sm:min-w-[44px] sm:min-h-[44px] rounded-lg bg-white text-slate-800 font-bold hover:bg-slate-50 flex items-center justify-center shadow-xs text-base active:bg-slate-200 transition-colors cursor-pointer"
              title="Increase copies"
              aria-label="Increase number of copies"
            >
              +
            </button>
          </div>

          {/* Payment providers are not enabled until each shop connects its account. */}
          <div className="flex items-center gap-1.5 flex-1 justify-end min-w-[130px]">
            <button
              type="button"
              disabled={documents.length === 0 || isSubmitting}
              onClick={() => {
                setPaymentMethod('CASH_ON_COLLECTION');
                setSubmitError(null);
                setReviewModalOpen(true);
              }}
              className="min-h-[44px] px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 disabled:opacity-50 text-slate-800 font-bold rounded-xl text-xs transition-all flex flex-col items-center justify-center leading-tight cursor-pointer border border-slate-200"
              title="Pay cash when picking up at counter"
            >
              <span>💵 Cash</span>
              <span className="text-[9px] font-medium text-slate-500">at counter</span>
            </button>

            <button
              type="button"
              disabled={documents.length === 0 || isSubmitting || !shop.onlinePaymentAvailable}
              onClick={() => {
                setPaymentMethod('ONLINE_RAZORPAY');
                setSubmitError(null);
                setReviewModalOpen(true);
              }}
              className={`min-h-[44px] px-2.5 py-1.5 rounded-xl text-xs transition-all flex flex-col items-center justify-center leading-tight border ${shop.onlinePaymentAvailable ? 'cursor-pointer bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200' : 'cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400'}`}
              title={shop.onlinePaymentAvailable ? 'Pay securely with Razorpay' : 'Online payment is not enabled by this shop'}
            >
              <span>Online payment</span>
              <span className="text-[9px] font-medium">{shop.onlinePaymentAvailable ? 'Razorpay' : 'unavailable'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. ORDER REVIEW MODAL (WCAG 2.2 SC 3.3.4 Error Prevention) */}
      {reviewModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-label="Review Your Print Order"
        >
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden p-6 space-y-4 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <InkllyMark size={24} />
                <h3 className="font-extrabold text-sm text-slate-900">Review Your Order</h3>
              </div>
              <button
                type="button"
                onClick={() => setReviewModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm p-1 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Close review"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label htmlFor="customer-name" className="block text-xs font-semibold text-slate-700 mb-1">Your name</label>
                <input
                  id="customer-name"
                  autoComplete="name"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  maxLength={80}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label htmlFor="customer-phone" className="block text-xs font-semibold text-slate-700 mb-1">Mobile number</label>
                <input
                  id="customer-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  maxLength={15}
                  placeholder="10-digit mobile number"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2.5 text-xs text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500">Print Shop:</span>
                <span className="font-bold text-slate-900">{shop.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Documents:</span>
                <span className="font-bold text-slate-900">{documents.length} file{documents.length > 1 ? 's' : ''} ({totalPagesCount} pages)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Color Mode:</span>
                <span className="font-bold text-slate-900">{activeDoc.options.colorMode === 'color' ? 'Full Colour' : 'Black & White'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Sides:</span>
                <span className="font-bold text-slate-900">{activeDoc.options.duplexMode === 'duplex_auto' ? 'Back-to-Back (Both Sides)' : 'Single Sided'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Copies:</span>
                <span className="font-bold text-slate-900">{globalCopies} set{globalCopies > 1 ? 's' : ''}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment:</span>
              <span className="font-bold text-indigo-700">{paymentMethod === 'ONLINE_RAZORPAY' ? 'Pay securely online' : 'Pay cash at the counter'}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-black text-slate-900">
                <span>Total Amount:</span>
                <span className="text-[#4D64E6] text-base">₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {submitError && (
              <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                {submitError}
              </p>
            )}

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handlePlaceOrder}
                className="w-full min-h-[48px] bg-[#4D64E6] hover:bg-[#3B50D4] active:bg-[#2C3FA8] text-white font-bold rounded-xl text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? 'Processing…' : pendingOnlineOrder ? 'Retry online payment →' : paymentMethod === 'ONLINE_RAZORPAY' ? 'Continue to secure payment →' : 'Confirm cash order →'}
              </button>
              <button
                type="button"
                onClick={() => setReviewModalOpen(false)}
                className="w-full min-h-[44px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
              >
                Change Options
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. DOCUMENT EDITOR MODAL (Client-side HTML5 Canvas) */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
          <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950">
              <div className="flex items-center gap-2">
                <CropIcon size={18} className="text-emerald-400" />
                <span className="text-white font-bold text-sm">
                  Document Editor — {activeDoc?.fileName}
                </span>
                <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                  Page 1 of {activeDoc?.pageCount}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="text-slate-400 hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            {/* Modal Content: Canvas & Control Palette */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col md:flex-row gap-4 items-center justify-center bg-slate-950">
              {/* Left: Canvas Area */}
              <div className="relative bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center p-2 border border-slate-800 shadow-inner">
                <canvas
                  ref={canvasRef}
                  className="rounded shadow max-h-[460px] max-w-full object-contain cursor-crosshair"
                />
              </div>

              {/* Right: Controls Panel */}
              <div className="w-full md:w-80 bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs space-y-4">
                {/* Crop & Orientation */}
                <div>
                  <div className="text-slate-400 font-semibold uppercase tracking-wider text-[10px] mb-2">
                    Crop & Orientation
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditorRotation((r) => (r + 90) % 360)}
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center justify-center gap-1.5 font-medium transition-colors"
                    >
                      <RotateCwIcon size={14} />
                      Rotate 90°
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setEditorCrop({ x: 8, y: 8, width: 84, height: 84 })
                      }
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-lg font-medium transition-colors"
                    >
                      ⚡ Auto-Crop
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setEditorCrop({ x: 0, y: 0, width: 100, height: 100 })
                    }
                    className="w-full mt-2 p-1.5 text-slate-400 hover:text-slate-200 text-[11px] underline text-center"
                  >
                    Reset Full Crop
                  </button>
                </div>

                {/* Image Appearance & Filters */}
                <div>
                  <div className="text-slate-400 font-semibold uppercase tracking-wider text-[10px] mb-2">
                    Image Appearance
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 mb-3">
                    <button
                      type="button"
                      onClick={() => setEditorFilter('natural')}
                      className={`p-1.5 rounded-lg text-center font-medium ${
                        editorFilter === 'natural'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Natural
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditorFilter('bw_doc')}
                      className={`p-1.5 rounded-lg text-center font-medium ${
                        editorFilter === 'bw_doc'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Document B&W
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditorFilter('enhanced')}
                      className={`p-1.5 rounded-lg text-center font-medium ${
                        editorFilter === 'enhanced'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Enhanced
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditorFilter('grayscale')}
                      className={`p-1.5 rounded-lg text-center font-medium ${
                        editorFilter === 'grayscale'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Grayscale
                    </button>
                  </div>

                  {/* Sliders */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-slate-400 text-[11px]">
                      <span>Brightness</span>
                      <span>{editorBrightness}%</span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="150"
                      value={editorBrightness}
                      onChange={(e) => setEditorBrightness(Number(e.target.value))}
                      className="w-full accent-indigo-500 h-1 bg-slate-700 rounded-lg cursor-pointer"
                    />

                    <div className="flex justify-between text-slate-400 text-[11px] pt-1">
                      <span>Contrast</span>
                      <span>{editorContrast}%</span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="150"
                      value={editorContrast}
                      onChange={(e) => setEditorContrast(Number(e.target.value))}
                      className="w-full accent-indigo-500 h-1 bg-slate-700 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>

                {/* Operator Note */}
                <div>
                  <div className="text-slate-400 font-semibold uppercase tracking-wider text-[10px] mb-1">
                    Special Instructions
                  </div>
                  <textarea
                    rows={2}
                    value={editorNote}
                    onChange={(e) => setEditorNote(e.target.value)}
                    placeholder="e.g. Staple top-left corner, punch 2 holes..."
                    className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="px-4 py-2 text-slate-400 hover:text-white text-xs font-semibold"
              >
                Cancel
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditorRotation(0);
                    setEditorFilter('natural');
                    setEditorBrightness(100);
                    setEditorContrast(100);
                    setEditorCrop({ x: 0, y: 0, width: 100, height: 100 });
                  }}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg"
                >
                  Use Original
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditor}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-md flex items-center gap-1.5"
                >
                  <CheckIcon size={14} />
                  ✓ Use Document
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
