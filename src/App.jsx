import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Settings,
  ChevronDown,
  ChevronUp,
  UserPlus,
  MessageSquareText,
  Sparkles,
  QrCode,
  CheckCircle2,
  Clock,
  Trash2,
  Copy,
  Check,
  Upload,
  Loader2,
  Wallet,
  TrendingUp,
  AlertCircle,
  Eye,
  EyeOff,
  X,
  Plus,
  RefreshCw,
  Receipt,
  Building2,
  CreditCard,
  User,
  KeyRound,
  Download,
  Users,
  List,
  Combine,
  Share2,
  Search,
  ShieldCheck,
  Smartphone,
  BellRing,
  FileCheck2
} from 'lucide-react';

// Danh sách ngân hàng phổ biến hỗ trợ VietQR (BIN & ShortName)
const VIETQR_BANKS = [
  { bin: '970436', code: 'VCB', name: 'Vietcombank - Ngân hàng TMCP Ngoại thương Việt Nam' },
  { bin: '970407', code: 'TCB', name: 'Techcombank - Ngân hàng TMCP Kỹ thương Việt Nam' },
  { bin: '970422', code: 'MB', name: 'MBBank - Ngân hàng TMCP Quân đội' },
  { bin: '970415', code: 'ICB', name: 'VietinBank - Ngân hàng TMCP Công thương Việt Nam' },
  { bin: '970418', code: 'BIDV', name: 'BIDV - Ngân hàng TMCP Đầu tư và Phát triển Việt Nam' },
  { bin: '970416', code: 'ACB', name: 'ACB - Ngân hàng TMCP Á Châu' },
  { bin: '970423', code: 'TPB', name: 'TPBank - Ngân hàng TMCP Tiên Phong' },
  { bin: '970432', code: 'VPB', name: 'VPBank - Ngân hàng TMCP Việt Nam Thịnh Vượng' },
  { bin: '970403', code: 'STB', name: 'Sacombank - Ngân hàng TMCP Sài Gòn Thương Tín' },
  { bin: '970405', code: 'VBA', name: 'Agribank - Ngân hàng NN&PT Nông thôn Việt Nam' },
  { bin: '970441', code: 'VIB', name: 'VIB - Ngân hàng TMCP Quốc tế Việt Nam' },
  { bin: '970448', code: 'OCB', name: 'OCB - Ngân hàng TMCP Phương Đông' },
  { bin: '970437', code: 'HDB', name: 'HDBank - Ngân hàng TMCP Phát triển TP.HCM' },
  { bin: '970426', code: 'MSB', name: 'MSB - Ngân hàng TMCP Hàng Hải Việt Nam' },
  { bin: '970443', code: 'SHB', name: 'SHB - Ngân hàng TMCP Sài Gòn - Hà Nội' },
];

const QUICK_AMOUNTS = [
  { label: '30k', value: 30000 },
  { label: '35k', value: 35000 },
  { label: '40k', value: 40000 },
  { label: '45k', value: 45000 },
  { label: '50k', value: 50000 },
  { label: '55k', value: 55000 },
  { label: '60k', value: 60000 },
];

const DEFAULT_TEAMMATES = ['anh Tài', 'anh Hà', 'anh Thành', 'Linh'];
const LEGACY_DEFAULT_TEAMMATES = new Set(['nam', 'hùng', 'trang', 'minh', 'hương', 'tuấn', 'lan']);

const DEFAULT_HOST_SETTINGS = {
  bankBin: '970436',
  accountNumber: '',
  accountName: '',
  geminiApiKey: '',
};

const STORAGE_KEYS = {
  HOST_SETTINGS: 'vietqr_lunch_tracker_host_settings_v1',
  PARTICIPANTS: 'vietqr_lunch_tracker_participants_v1',
  TEAMMATES: 'vietqr_lunch_tracker_teammates_v2',
  VIEW_MODE: 'vietqr_lunch_tracker_view_mode_v1',
};

// Sử dụng model gemini-3.8-flash hiện hành thay cho gemini-1.5-flash đã ngừng hỗ trợ
const GEMINI_MODEL = 'gemini-3.8-flash';

/**
 * Định dạng số tiền sang chuẩn tiền tệ VNĐ
 */
function formatVND(amount) {
  const numeric = Number(amount) || 0;
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(numeric);
}

/**
 * Chuyển chuỗi tiếng Việt có dấu sang không dấu ASCII (an toàn cho nội dung CK NAPAS247 / VietQR)
 */
export function removeVietnameseTones(str) {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Chuẩn hóa khóa định danh người dùng để gộp chính xác (VD: "  nam " và "Nam" là cùng 1 người)
 */
export function normalizePersonKey(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * Mã hóa / Giải mã dữ liệu chia sẻ trên URL (UTF-8 Base64 an toàn) để gửi link cho người trả tiền
 */
export function encodeSharePayload(payload) {
  try {
    if (payload?.host && Array.isArray(payload?.items)) {
      const compact = {
        v: 2,
        b: payload.host.bankBin || '',
        a: payload.host.accountNumber || '',
        n: payload.host.accountName || '',
        i: payload.items.map((it) => [
          it.name,
          it.amount,
          it.note || '',
          it.paid ? 1 : 0,
        ]),
      };
      const json = JSON.stringify(compact);
      const bytes = new TextEncoder().encode(json);
      let binary = '';
      bytes.forEach((b) => {
        binary += String.fromCharCode(b);
      });
      return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    const json = JSON.stringify(payload);
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    bytes.forEach((b) => {
      binary += String.fromCharCode(b);
    });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch {
    return '';
  }
}

export function decodeSharePayload(encoded) {
  try {
    if (!encoded) return null;
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json);

    // Chuẩn v2 nén siêu gọn
    if (parsed && (parsed.v === 2 || parsed.b !== undefined)) {
      return {
        host: {
          bankBin: parsed.b || '',
          accountNumber: parsed.a || '',
          accountName: parsed.n || '',
        },
        items: (parsed.i || []).map((it, idx) => ({
          id: `share-${idx}-${Date.now().toString(36)}`,
          name: it[0],
          amount: it[1],
          note: it[2] || '',
          paid: Boolean(it[3]),
        })),
      };
    }

    // Tương thích ngược với định dạng v1 cũ
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Tách phần Tên người và Ghi chú món ăn nếu người dùng viết gộp (VD: "Nam - Cơm sườn" hoặc "Linh (Trà đào)")
 */
export function splitNameAndNote(rawLabel) {
  const cleaned = String(rawLabel || '').trim();
  if (!cleaned) return { name: '', note: '' };

  const parenMatch = cleaned.match(/^(.+?)\s*\((.+)\)$/);
  if (parenMatch) {
    return {
      name: parenMatch[1].trim(),
      note: parenMatch[2].trim(),
    };
  }

  const dashMatch = cleaned.match(/^(.+?)\s*(?:[-–—:]|\s+[-–—:]\s+)\s*(.+)$/);
  if (dashMatch) {
    return {
      name: dashMatch[1].trim(),
      note: dashMatch[2].trim(),
    };
  }

  return { name: cleaned, note: '' };
}

/**
 * Chuyển chuỗi số tiền + đơn vị tiếng Việt sang số nguyên VNĐ an toàn
 */
export function parseMoneyValue(rawNumber, rawUnit = '') {
  if (typeof rawNumber === 'number' && !isNaN(rawNumber)) {
    return rawNumber > 0 && rawNumber < 1000 ? Math.round(rawNumber * 1000) : Math.round(rawNumber);
  }

  let numStr = String(rawNumber || '').trim();
  if (!numStr) return 0;

  let unit = String(rawUnit || '').toLowerCase().trim();

  // Nhận diện đơn vị đính kèm trong chuỗi nếu có (VD: "75k", "75.5k", "75 cành")
  if (!unit) {
    const inlineUnitMatch = numStr.match(/(k|ngàn|ngan|nghìn|nghin|cành|canh|lít|lit|đồng|dong|vnđ|vnd|đ|d)$/i);
    if (inlineUnitMatch) {
      unit = inlineUnitMatch[1].toLowerCase();
      numStr = numStr.slice(0, -inlineUnitMatch[0].length).trim();
    }
  }

  // Hỗ trợ số tiền viết dạng "75k815" hoặc "75k5"
  const kMidMatch = numStr.match(/^(\d+)\s*(?:k|ngàn|nghìn|cành)\s*(\d{1,3})$/i);
  if (kMidMatch) {
    const intPart = parseInt(kMidMatch[1], 10);
    const fracStr = kMidMatch[2];
    if (fracStr.length === 3) {
      return intPart * 1000 + parseInt(fracStr, 10);
    } else if (fracStr.length === 2) {
      return intPart * 1000 + parseInt(fracStr, 10) * 10;
    } else {
      return intPart * 1000 + parseInt(fracStr, 10) * 100;
    }
  }

  const isThousandUnit = ['k', 'ngàn', 'ngan', 'nghìn', 'nghin', 'cành', 'canh'].includes(unit);
  const isHundredThousandUnit = ['lít', 'lit'].includes(unit);

  const hasThousandGrouping = /^\d{1,3}(?:[.,]\d{3})+$/.test(numStr);

  if (isThousandUnit && !hasThousandGrouping) {
    const normalizedFloat = parseFloat(numStr.replace(',', '.'));
    return isNaN(normalizedFloat) ? 0 : Math.round(normalizedFloat * 1000);
  }

  if (isHundredThousandUnit && !hasThousandGrouping) {
    const normalizedFloat = parseFloat(numStr.replace(',', '.'));
    return isNaN(normalizedFloat) ? 0 : Math.round(normalizedFloat * 100000);
  }

  const digitsOnly = numStr.replace(/[.,\s]/g, '');
  const parsedInt = parseInt(digitsOnly, 10);
  if (isNaN(parsedInt) || parsedInt <= 0) return 0;

  // Nếu người dùng nhập số tắt quá nhỏ (< 1000, VD: 75 -> 75.000đ)
  // Nếu nhập số từ 1000 trở lên (VD: 75815, 12500, 75.815), giữ nguyên chính xác từng đồng lẻ!
  return parsedInt < 1000 ? parsedInt * 1000 : parsedInt;
}

/**
 * Hàm phân tích cú pháp tin nhắn Zalo / Chat thô sang danh sách [{ name, note, amount }]
 */
export function parseZaloChatLog(rawText) {
  if (!rawText || !rawText.trim()) return [];

  let normalizedText = rawText
    .replace(/(\d),(\d{3})(?=(?:[.,]\d{3})*(?!\d))/g, '$1.$2')
    .replace(/(\d),(\d{3})(?=(?:[.,]\d{3})*(?!\d))/g, '$1.$2')
    .replace(
      /(\d+)\s*(k|ngàn|ngan|nghìn|nghin|cành|canh)\s*(\d{1,2})\b/giu,
      (_, intPart, _unit, decPart) => `${intPart}.${decPart}k`
    )
    .replace(
      /(\d+)\s*(?:k|ngàn|ngan|nghìn|nghin|cành|canh)?\s*rưỡi\b/giu,
      (_, intPart) => `${intPart}.5k`
    )
    .replace(
      /(\d+)\s*(lít|lit)\s*(\d{1,2})\b/giu,
      (_, intPart, _unit, decPart) => `${intPart}.${decPart} lít`
    );

  const rawLines = normalizedText
    .replace(
      /(\d+(?:[.,]\d+)?\s*(?:k|ngàn|ngan|nghìn|nghin|cành|canh|lít|lit|đồng|dong|vnđ|vnd|đ|d)?)\s+[-–—]\s+(?=[\p{L}\p{M}])/giu,
      '$1\n'
    )
    .split(/(?:\r?\n|;)+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const extracted = [];

  const singleEntryRegex =
    /^(?:(?:\[\d{1,2}:\d{2}\]|\d+[.)]|[-*•+])\s*)*([\p{L}\p{M}0-9\s_():.–—-]+?)\s*[:=\->\s]+\s*(\d+(?:[.,]\d{3})*(?:[.,]\d+)?)\s*(k|ngàn|ngan|nghìn|nghin|cành|canh|lít|lit|đồng|dong|vnđ|vnd|đ|d)?(?=\s|$|[,.!)])/iu;

  for (const line of rawLines) {
    const commaSegments = line
      .split(/,(?!\d)/)
      .map((s) => s.trim())
      .filter(Boolean);

    for (const commaSeg of commaSegments) {
      const plusParts = commaSeg
        .split(/\+/)
        .map((s) => s.trim())
        .filter(Boolean);

      let currentPersonName = '';

      for (let idx = 0; idx < plusParts.length; idx++) {
        const part = plusParts[idx];

        const amountOnlyMatch = part.match(
          /^(\d+(?:[.,]\d{3})*(?:[.,]\d+)?)\s*(k|ngàn|ngan|nghìn|nghin|cành|canh|lít|lit|đồng|dong|vnđ|vnd|đ|d)?$/iu
        );

        if (amountOnlyMatch && currentPersonName) {
          const amount = parseMoneyValue(amountOnlyMatch[1], amountOnlyMatch[2]);
          if (amount > 0) {
            extracted.push({
              name: currentPersonName,
              note: 'Khoản cộng thêm',
              amount,
            });
          }
          continue;
        }

        const match = part.match(singleEntryRegex);
        if (!match) continue;

        const rawLabel = match[1].replace(/^[-:•*+\s]+|[-:•*+\s]+$/g, '').trim();
        if (!rawLabel) continue;

        const { name, note } = splitNameAndNote(rawLabel);
        if (!name) continue;

        const amount = parseMoneyValue(match[2], match[3]);
        if (amount <= 0) continue;

        if (idx > 0 && currentPersonName && !note) {
          extracted.push({
            name: currentPersonName,
            note: name,
            amount,
          });
        } else {
          currentPersonName = name;
          extracted.push({
            name,
            note,
            amount,
          });
        }
      }
    }
  }

  return extracted;
}

/**
 * Đối soát tự động từ văn bản thông báo biến động số dư (SMS / App Ngân hàng)
 * VD: "TK 01234xxx +70,000VND luc 14:20. ND: NAM thanh toan"
 */
export function matchBankNotificationText(rawNotifText, aggregatedPeople) {
  if (!rawNotifText || !rawNotifText.trim() || !Array.isArray(aggregatedPeople)) {
    return [];
  }

  const normalizedNotif = removeVietnameseTones(rawNotifText).toLowerCase();

  // Trích xuất tất cả các con số dạng tiền (+70,000 / 70.000 / 70000) trong thông báo
  const amountMatches = Array.from(
    rawNotifText.matchAll(/(?:\+|\b)(\d{1,3}(?:[.,]\d{3})+|\d{5,9})(?:\s*(?:vnd|vnđ|đ|d)\b)?/gi)
  ).map((m) => parseInt(m[1].replace(/[.,]/g, ''), 10));

  const matchedPeople = [];

  for (const person of aggregatedPeople) {
    if (person.allPaid) continue;
    const asciiName = removeVietnameseTones(person.displayName).toLowerCase().trim();
    if (!asciiName) continue;

    // Hỗ trợ khớp cả tên đầy đủ ("anh tai") lẫn tên gọi tắt bỏ danh xưng ("tai") khi đi kèm đúng số tiền
    const shortName = asciiName.replace(/^(?:anh|chi|em|ban|co|chu|sep)\s+/i, '').trim();
    const fullRegex = new RegExp(`\\b${asciiName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    const shortRegex =
      shortName && shortName.length >= 2
        ? new RegExp(`\\b${shortName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
        : null;

    const hasFullNameInText = fullRegex.test(normalizedNotif);
    const hasShortNameInText = shortRegex ? shortRegex.test(normalizedNotif) : false;
    const hasExactUnpaidAmount = amountMatches.includes(person.unpaidAmount);

    if (
      ((hasFullNameInText || hasShortNameInText) && hasExactUnpaidAmount) ||
      (hasFullNameInText && amountMatches.length === 0)
    ) {
      matchedPeople.push(person);
    }
  }

  return matchedPeople;
}

/**
 * Nén và thu phóng ảnh trên trình duyệt qua <canvas> trước khi chuyển sang Base64
 */
async function compressImageToBase64(file, maxDimension = 1600, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = (err) => reject(err);
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const img = new Image();
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          const base64Data = compressedDataUrl.split(',')[1];
          resolve({ base64Data, mimeType: 'image/jpeg' });
        } catch {
          const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
          resolve({ base64Data, mimeType: file.type || 'image/jpeg' });
        }
      };
      img.onerror = () => {
        const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
        resolve({ base64Data, mimeType: file.type || 'image/jpeg' });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Tạo URL ảnh VietQR động với đầy đủ URL encoding & chuẩn ASCII không dấu
 */
export function buildVietQrUrl({ bankBin, accountNumber, accountName, amount, participantName }) {
  const cleanBank = (bankBin || '').trim();
  const cleanAccount = (accountNumber || '').trim();
  const safeAmount = Math.max(0, Math.round(Number(amount) || 0));
  const safePersonName = removeVietnameseTones(participantName || 'Ban').slice(0, 28) || 'Ban';
  const transferInfo = `${safePersonName} thanh toan`;
  const cleanAccName = removeVietnameseTones(accountName || '').toUpperCase();

  const baseUrl = `https://img.vietqr.io/image/${encodeURIComponent(cleanBank)}-${encodeURIComponent(
    cleanAccount
  )}-compact2.png`;

  const queryParams = new URLSearchParams({
    amount: String(safeAmount),
    addInfo: transferInfo,
    accountName: cleanAccName,
  });

  return `${baseUrl}?${queryParams.toString().replace(/\+/g, '%20')}`;
}

export default function App() {
  // Kiểm tra nếu URL có chứa dữ liệu chia sẻ cho người trả tiền (?share=...&person=...)
  const sharedUrlParams = useMemo(() => {
    if (typeof window === 'undefined') {
      return { isSharedLink: false, payload: null, personFilter: '' };
    }
    const params = new URLSearchParams(window.location.search);
    const shareToken = params.get('share');
    const personParam = params.get('person') || '';
    const modeParam = params.get('role');
    const decoded = decodeSharePayload(shareToken);
    return {
      isSharedLink: Boolean(decoded) || modeParam === 'payer',
      payload: decoded,
      personFilter: personParam,
    };
  }, []);

  // =================================================================
  // CHẾ ĐỘ GIAO DIỆN: 'host' (Giao diện của tôi) | 'payer' (Người trả tiền)
  // =================================================================
  const [appRole, setAppRole] = useState(() =>
    sharedUrlParams.isSharedLink ? 'payer' : 'host'
  );
  const [payerSearchQuery, setPayerSearchQuery] = useState(() => sharedUrlParams.personFilter || '');

  // ==========================================
  // PHASE 1: STATE MANAGEMENT & HOST SETTINGS
  // ==========================================
  const [hostSettings, setHostSettings] = useState(() => {
    if (sharedUrlParams.payload?.host) {
      return {
        ...DEFAULT_HOST_SETTINGS,
        ...sharedUrlParams.payload.host,
        geminiApiKey: '',
      };
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.HOST_SETTINGS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return { ...DEFAULT_HOST_SETTINGS, ...parsed };
        }
      }
    } catch (e) {
      console.error('Lỗi đọc cài đặt từ localStorage:', e);
    }
    return DEFAULT_HOST_SETTINGS;
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.HOST_SETTINGS);
      if (saved) {
        const parsed = JSON.parse(saved);
        return !(parsed?.bankBin && parsed?.accountNumber);
      }
    } catch {
      // ignore
    }
    return true;
  });

  const [showApiKey, setShowApiKey] = useState(false);

  const [participants, setParticipants] = useState(() => {
    if (Array.isArray(sharedUrlParams.payload?.items)) {
      return sharedUrlParams.payload.items;
    }
    const defaultStarterList = [
      { id: 'member-1', name: 'anh Tài', note: 'Cơm sườn', amount: 45000, paid: false },
      { id: 'member-2', name: 'anh Tài', note: 'Trà đào', amount: 25000, paid: false },
      { id: 'member-3', name: 'anh Hà', note: 'Phở bò', amount: 50000, paid: false },
      { id: 'member-4', name: 'anh Thành', note: 'Bún chả', amount: 45000, paid: false },
      { id: 'member-5', name: 'Linh', note: 'Bún bò', amount: 50000, paid: true },
    ];
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PARTICIPANTS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Nếu đang là dữ liệu demo cũ chưa chỉnh sửa (demo-1: Nam), tự động nâng cấp sang danh sách thành viên mới
          const isUntouchedLegacyDemo =
            parsed.length === 3 &&
            parsed.every((item) => String(item.id).startsWith('demo-')) &&
            parsed.some((item) => item.name === 'Nam');
          return isUntouchedLegacyDemo ? defaultStarterList : parsed;
        }
      }
    } catch (e) {
      console.error('Lỗi đọc danh sách từ localStorage:', e);
    }
    return defaultStarterList;
  });

  const [savedTeammates, setSavedTeammates] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TEAMMATES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const merged = [...DEFAULT_TEAMMATES];
          const seen = new Set(merged.map((n) => normalizePersonKey(n)));
          for (const item of parsed) {
            const key = normalizePersonKey(item);
            if (key && !seen.has(key) && !LEGACY_DEFAULT_TEAMMATES.has(key)) {
              seen.add(key);
              merged.push(item);
            }
          }
          return merged;
        }
      }
    } catch (e) {
      console.error('Lỗi đọc danh sách đồng nghiệp từ localStorage:', e);
    }
    return DEFAULT_TEAMMATES;
  });

  // Đảm bảo danh sách thành viên ['anh Tài', 'anh Hà', 'anh Thành', 'Linh'] luôn được cập nhật ngay cả khi Hot Reload
  useEffect(() => {
    setSavedTeammates((prev) => {
      const merged = [...DEFAULT_TEAMMATES];
      const seen = new Set(merged.map((n) => normalizePersonKey(n)));
      for (const item of prev) {
        const key = normalizePersonKey(item);
        if (key && !seen.has(key) && !LEGACY_DEFAULT_TEAMMATES.has(key)) {
          seen.add(key);
          merged.push(item);
        }
      }
      return merged;
    });

    setParticipants((prev) => {
      const isUntouchedLegacyDemo =
        prev.length === 3 &&
        prev.every((item) => String(item.id).startsWith('demo-')) &&
        prev.some((item) => item.name === 'Nam');
      if (!isUntouchedLegacyDemo) return prev;
      return [
        { id: 'member-1', name: 'anh Tài', note: 'Cơm sườn', amount: 45000, paid: false },
        { id: 'member-2', name: 'anh Tài', note: 'Trà đào', amount: 25000, paid: false },
        { id: 'member-3', name: 'anh Hà', note: 'Phở bò', amount: 50000, paid: false },
        { id: 'member-4', name: 'anh Thành', note: 'Bún chả', amount: 45000, paid: false },
        { id: 'member-5', name: 'Linh', note: 'Bún bò', amount: 50000, paid: true },
      ];
    });
  }, []);

  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.VIEW_MODE) || 'grouped';
    } catch {
      return 'grouped';
    }
  });

  // Đồng bộ thời gian thực giữa 2 tab trên cùng trình duyệt (Storage Event)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === STORAGE_KEYS.PARTICIPANTS && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) setParticipants(parsed);
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    if (sharedUrlParams.payload) return;
    try {
      localStorage.setItem(STORAGE_KEYS.HOST_SETTINGS, JSON.stringify(hostSettings));
    } catch (e) {
      console.error('Không thể lưu cài đặt:', e);
    }
  }, [hostSettings, sharedUrlParams.payload]);

  useEffect(() => {
    if (sharedUrlParams.payload) return;
    try {
      localStorage.setItem(STORAGE_KEYS.PARTICIPANTS, JSON.stringify(participants));
    } catch (e) {
      console.error('Không thể lưu danh sách người tham gia:', e);
    }
  }, [participants, sharedUrlParams.payload]);

  useEffect(() => {
    if (sharedUrlParams.payload) return;
    try {
      localStorage.setItem(STORAGE_KEYS.TEAMMATES, JSON.stringify(savedTeammates));
    } catch (e) {
      console.error('Không thể lưu danh sách đồng nghiệp:', e);
    }
  }, [savedTeammates, sharedUrlParams.payload]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.VIEW_MODE, viewMode);
    } catch {
      // ignore
    }
  }, [viewMode]);

  // ==========================================
  // PHASE 2: INPUT AUTOMATION ENGINE STATES
  // ==========================================
  const [activeTab, setActiveTab] = useState('manual'); // 'manual' | 'paste' | 'ai' | 'reconcile'

  // Tab 1: Nhập tay
  const [manualName, setManualName] = useState('');
  const [manualNote, setManualNote] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [newTeammateInput, setNewTeammateInput] = useState('');
  const [showAddTeammate, setShowAddTeammate] = useState(false);

  // Tab 2: Dán tin nhắn Zalo
  const [chatLogText, setChatLogText] = useState('');
  const parsedPreview = useMemo(() => parseZaloChatLog(chatLogText), [chatLogText]);

  // Tab 3: Quét ảnh hóa đơn bằng AI (Gemini Vision)
  const [isScanning, setIsScanning] = useState(false);
  const [scanPreviewUrl, setScanPreviewUrl] = useState(null);
  const [scanError, setScanError] = useState('');
  const [scanSuccessMsg, setScanSuccessMsg] = useState('');
  const fileInputRef = useRef(null);

  // Tab 4: Tự động nhận biết đã chuyển tiền (Đối soát SMS Biến động số dư / Ảnh biên lai UNC bằng AI)
  const [bankNotifText, setBankNotifText] = useState('');
  const [isVerifyingReceipt, setIsVerifyingReceipt] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState(null); // { type: 'success' | 'error', text: string }
  const receiptVerifyInputRef = useRef(null);

  // Thông báo nhanh (Toast)
  const [toastMessage, setToastMessage] = useState(null);

  // ==========================================
  // PHASE 3: VIETQR MODAL & DASHBOARD STATES
  // ==========================================
  const [qrTarget, setQrTarget] = useState(null);
  const [qrCopied, setQrCopied] = useState(false);
  const [isDownloadingQr, setIsDownloadingQr] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'unpaid' | 'paid'
  const qrDialogRef = useRef(null);

  useEffect(() => {
    return () => {
      if (scanPreviewUrl) {
        URL.revokeObjectURL(scanPreviewUrl);
      }
    };
  }, [scanPreviewUrl]);

  useEffect(() => {
    const dialog = qrDialogRef.current;
    if (!dialog) return;
    if (qrTarget && !dialog.open) {
      dialog.showModal();
    } else if (!qrTarget && dialog.open) {
      dialog.close();
    }
  }, [qrTarget]);

  useEffect(() => {
    const dialog = qrDialogRef.current;
    if (!dialog) return;

    const handleNativeClose = () => {
      setQrTarget(null);
      setQrCopied(false);
    };

    dialog.addEventListener('close', handleNativeClose);

    let handleBackdropClick = null;
    if (typeof HTMLDialogElement !== 'undefined' && !('closedBy' in HTMLDialogElement.prototype)) {
      handleBackdropClick = (event) => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        const isDialogContent =
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width;
        if (!isDialogContent) {
          dialog.close();
        }
      };
      dialog.addEventListener('click', handleBackdropClick);
    }

    return () => {
      dialog.removeEventListener('close', handleNativeClose);
      if (handleBackdropClick) {
        dialog.removeEventListener('click', handleBackdropClick);
      }
    };
  }, []);

  const openQrModal = (target) => {
    setQrCopied(false);
    setQrTarget(target);
  };

  const closeQrModal = () => {
    if (qrDialogRef.current && qrDialogRef.current.open) {
      qrDialogRef.current.close();
    } else {
      setQrTarget(null);
    }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  // =========================================================================
  // TỔNG HỢP SỐ TIỀN CẦN TRẢ THEO TỪNG NGƯỜI (PER-PERSON AGGREGATION ENGINE)
  // =========================================================================
  const aggregatedPeople = useMemo(() => {
    const map = new Map();

    for (const item of participants) {
      const key = normalizePersonKey(item.name);
      if (!key) continue;

      if (!map.has(key)) {
        map.set(key, {
          personKey: key,
          displayName: item.name.trim(),
          totalAmount: 0,
          paidAmount: 0,
          unpaidAmount: 0,
          items: [],
        });
      }

      const group = map.get(key);
      const amt = Number(item.amount) || 0;
      group.totalAmount += amt;
      if (item.paid) {
        group.paidAmount += amt;
      } else {
        group.unpaidAmount += amt;
      }
      group.items.push(item);
    }

    return Array.from(map.values()).map((group) => ({
      ...group,
      allPaid: group.items.length > 0 && group.unpaidAmount === 0,
      partiallyPaid: group.paidAmount > 0 && group.unpaidAmount > 0,
      qrAmount: group.unpaidAmount > 0 ? group.unpaidAmount : group.totalAmount,
    }));
  }, [participants]);

  // Nếu link chia sẻ chỉ định sẵn tên người (?person=Nam), tự động mở QR cho người đó
  useEffect(() => {
    if (sharedUrlParams.personFilter && aggregatedPeople.length > 0) {
      const targetKey = normalizePersonKey(sharedUrlParams.personFilter);
      const found = aggregatedPeople.find((p) => p.personKey === targetKey);
      if (found) {
        setQrTarget({ mode: 'person', personKey: found.personKey });
      }
    }
  }, [sharedUrlParams.personFilter, aggregatedPeople]);

  // Thống kê thời gian thực: Tổng thu, Đã thu, Còn lại
  const stats = useMemo(() => {
    const total = participants.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const collected = participants
      .filter((p) => p.paid)
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const remaining = Math.max(0, total - collected);
    const paidPeopleCount = aggregatedPeople.filter((person) => person.allPaid).length;
    const totalPeopleCount = aggregatedPeople.length;
    const progressPercent = total > 0 ? Math.round((collected / total) * 100) : 0;

    return {
      total,
      collected,
      remaining,
      paidPeopleCount,
      totalPeopleCount,
      progressPercent,
    };
  }, [participants, aggregatedPeople]);

  const filteredPeople = useMemo(() => {
    if (filterStatus === 'unpaid') return aggregatedPeople.filter((p) => !p.allPaid);
    if (filterStatus === 'paid') return aggregatedPeople.filter((p) => p.allPaid);
    return aggregatedPeople;
  }, [aggregatedPeople, filterStatus]);

  const payerFilteredPeople = useMemo(() => {
    const q = normalizePersonKey(payerSearchQuery);
    if (!q) return aggregatedPeople;
    return aggregatedPeople.filter(
      (p) =>
        p.personKey.includes(q) ||
        removeVietnameseTones(p.displayName)
          .toLowerCase()
          .includes(removeVietnameseTones(q).toLowerCase())
    );
  }, [aggregatedPeople, payerSearchQuery]);

  const filteredItems = useMemo(() => {
    if (filterStatus === 'unpaid') return participants.filter((p) => !p.paid);
    if (filterStatus === 'paid') return participants.filter((p) => p.paid);
    return participants;
  }, [participants, filterStatus]);

  // Tạo đường dẫn chia sẻ sạch sẽ (rút gọn dữ liệu nén, tách riêng người nếu có)
  const buildShareUrl = (specificPersonName = '') => {
    let itemsToShare = participants;
    if (specificPersonName) {
      const targetKey = normalizePersonKey(specificPersonName);
      itemsToShare = participants.filter((p) => normalizePersonKey(p.name) === targetKey);
    }

    const shareData = {
      host: {
        bankBin: hostSettings.bankBin,
        accountNumber: hostSettings.accountNumber,
        accountName: hostSettings.accountName,
      },
      items: itemsToShare,
    };
    const token = encodeSharePayload(shareData);
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('share', token);
    if (specificPersonName) {
      url.searchParams.set('person', specificPersonName);
    }
    return url.toString();
  };

  // Tạo và sao chép Link dành riêng cho Người trả tiền (không lộ API Key, không có nút cài đặt)
  const handleCopyShareLink = async (specificPersonName = '') => {
    const urlStr = buildShareUrl(specificPersonName);
    try {
      await navigator.clipboard.writeText(urlStr);
      showToast(
        specificPersonName
          ? `Đã chép Link thanh toán riêng cho ${specificPersonName}!`
          : 'Đã chép Link rút gọn để gửi nhóm Zalo!'
      );
    } catch {
      showToast('Không thể sao chép link tự động.');
    }
  };

  // Sao chép tin nhắn tổng hợp định dạng sẵn kèm link mở QR để gửi Zalo
  const handleCopyZaloSummaryMessage = async () => {
    const urlStr = buildShareUrl();
    const unpaidList = aggregatedPeople.filter((p) => !p.allPaid);
    const listToReport = unpaidList.length > 0 ? unpaidList : aggregatedPeople;

    if (listToReport.length === 0) {
      showToast('Chưa có khoản thu nào để tạo tin nhắn!');
      return;
    }

    const messageLines = [
      '📢 MỌI NGƯỜI CHUYỂN KHOẢN TIỀN ĂN UỐNG GIÚP MÌNH NHÉ:',
      ...listToReport.map((p, idx) => {
        const itemDetails = p.items
          .map((i) => (i.note ? `${i.note} (${formatVND(i.amount)})` : formatVND(i.amount)))
          .join(' + ');
        return `${idx + 1}. ${p.displayName}: ${formatVND(p.qrAmount)} [${itemDetails}]`;
      }),
      '',
      `👉 Quét mã VietQR chuyển khoản nhanh tại: ${urlStr}`,
    ];

    try {
      await navigator.clipboard.writeText(messageLines.join('\n'));
      showToast('Đã chép tin nhắn Zalo kèm bảng kê & link mở QR!');
    } catch {
      showToast('Không thể sao chép tự động.');
    }
  };

  // Thêm 1 hoặc nhiều khoản vào danh sách
  const addParticipants = (items) => {
    const validItems = items
      .map((item) => {
        const split = splitNameAndNote(item.name);
        const finalName = split.name;
        const finalNote = item.note ? String(item.note).trim() : split.note;

        return {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: finalName,
          note: finalNote,
          amount: parseMoneyValue(item.amount),
          paid: false,
        };
      })
      .filter((item) => item.name && item.amount > 0);

    if (validItems.length === 0) return 0;

    setParticipants((prev) => [...validItems, ...prev]);

    setSavedTeammates((prev) => {
      const existingLower = new Set(prev.map((n) => normalizePersonKey(n)));
      const additions = [];
      for (const item of validItems) {
        const key = normalizePersonKey(item.name);
        if (item.name.length <= 20 && key && !existingLower.has(key)) {
          existingLower.add(key);
          additions.push(item.name);
        }
      }
      return additions.length > 0 ? [...prev, ...additions] : prev;
    });

    return validItems.length;
  };

  // Gộp cứng các khoản trùng tên của cùng 1 người thành 1 dòng duy nhất
  const mergeDuplicatePeopleEntries = () => {
    const hasDuplicates = aggregatedPeople.some((p) => p.items.length > 1);
    if (!hasDuplicates) {
      showToast('Mỗi người hiện chỉ có 1 khoản, không có mục trùng cần gộp!');
      return;
    }

    const mergedList = [];
    for (const group of aggregatedPeople) {
      const unpaidItems = group.items.filter((i) => !i.paid);
      const paidItems = group.items.filter((i) => i.paid);

      if (unpaidItems.length > 0) {
        const notes = unpaidItems
          .map((i) => (i.note ? `${i.note} (${formatVND(i.amount)})` : formatVND(i.amount)))
          .join(' + ');
        mergedList.push({
          id: unpaidItems[0].id,
          name: group.displayName,
          note:
            unpaidItems.length > 1
              ? `Gộp ${unpaidItems.length} khoản: ${notes}`
              : unpaidItems[0].note || '',
          amount: group.unpaidAmount,
          paid: false,
        });
      }

      if (paidItems.length > 0) {
        const notes = paidItems
          .map((i) => (i.note ? `${i.note} (${formatVND(i.amount)})` : formatVND(i.amount)))
          .join(' + ');
        mergedList.push({
          id: paidItems[0].id,
          name: group.displayName,
          note:
            paidItems.length > 1
              ? `Đã trả ${paidItems.length} khoản: ${notes}`
              : paidItems[0].note || '',
          amount: group.paidAmount,
          paid: true,
        });
      }
    }

    setParticipants(mergedList);
    showToast('Đã gộp cộng dồn các khoản theo từng người!');
  };

  // Xử lý Tab 1: Nhập tay
  const handleManualSubmit = (e) => {
    e.preventDefault();
    const cleanName = manualName.trim();
    const numericAmount = parseMoneyValue(manualAmount);

    if (!cleanName || !numericAmount || numericAmount <= 0) {
      showToast('Vui lòng nhập tên và số tiền hợp lệ!');
      return;
    }

    addParticipants([{ name: cleanName, note: manualNote.trim(), amount: numericAmount }]);
    setManualName('');
    setManualNote('');
    setManualAmount('');
    showToast(`Đã thêm ${cleanName} (${formatVND(numericAmount)})`);
  };

  const handleAddTeammateChip = (e) => {
    e.preventDefault();
    const clean = newTeammateInput.trim();
    if (!clean) return;
    if (!savedTeammates.some((t) => normalizePersonKey(t) === normalizePersonKey(clean))) {
      setSavedTeammates((prev) => [...prev, clean]);
    }
    setManualName(clean);
    setNewTeammateInput('');
    setShowAddTeammate(false);
  };

  const handleRemoveTeammateChip = (nameToRemove) => {
    setSavedTeammates((prev) => prev.filter((t) => t !== nameToRemove));
  };

  // Xử lý Tab 2: Dán tin nhắn Zalo
  const handleSmartPasteImport = () => {
    if (parsedPreview.length === 0) {
      showToast('Chưa nhận diện được dữ liệu. Hãy kiểm tra cú pháp (VD: Nam 50k)!');
      return;
    }
    const count = addParticipants(parsedPreview);
    setChatLogText('');
    showToast(`Đã nhập tự động ${count} khoản từ tin nhắn!`);
  };

  // Xử lý Tab 3: Quét ảnh hóa đơn bằng AI (Gemini API)
  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setScanError('');
    setScanSuccessMsg('');

    const objectUrl = URL.createObjectURL(file);
    setScanPreviewUrl(objectUrl);

    if (!hostSettings.geminiApiKey.trim()) {
      setScanError(
        'Vui lòng nhập Gemini API Key trong mục "Cài đặt nhận tiền" ở phía trên trước khi quét ảnh.'
      );
      setIsSettingsOpen(true);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsScanning(true);

    try {
      const { base64Data, mimeType } = await compressImageToBase64(file);
      const apiKey = hostSettings.geminiApiKey.trim();

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(
        apiKey
      )}`;

      const promptText = `Bạn là trợ lý kế toán thông minh cho dân văn phòng Việt Nam.
Hãy phân tích hình ảnh hóa đơn, danh sách đặt đồ ăn/thức uống hoặc ảnh chụp màn hình nhóm chat này.
Trích xuất danh sách từng người đặt (nếu hóa đơn chỉ có tên món ăn mà không có tên người thì dùng tên món làm name; nếu có cả tên người và tên món thì tách riêng name và note) cùng số tiền tương ứng (đơn vị VNĐ nguyên, ví dụ 45k hoặc 45.000 thì ghi là 45000).
CHỈ trả về duy nhất một mảng JSON hợp lệ theo cấu trúc:
[{"name": "Tên người hoặc món", "note": "Ghi chú món (nếu có)", "amount": 50000}]
Không giải thích thêm, không bọc markdown.`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Data,
                  },
                },
                {
                  text: promptText,
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        const errMsg =
          errBody?.error?.message || `Lỗi kết nối Gemini API (HTTP ${response.status})`;
        throw new Error(errMsg);
      }

      const data = await response.json();
      const rawOutputText =
        data?.candidates?.[0]?.content?.parts
          ?.map((part) => part.text || '')
          .join('\n')
          .trim() || '';

      if (!rawOutputText) {
        throw new Error('AI không trả về dữ liệu văn bản nào từ ảnh này.');
      }

      const cleanedJsonText = rawOutputText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      const parsedJson = JSON.parse(cleanedJsonText);
      const parsedArray = Array.isArray(parsedJson)
        ? parsedJson
        : parsedJson?.items || parsedJson?.data || [];

      if (!Array.isArray(parsedArray) || parsedArray.length === 0) {
        throw new Error('Không tìm thấy khoản thanh toán nào trong ảnh.');
      }

      const addedCount = addParticipants(
        parsedArray.map((item) => ({
          name: item.name,
          note: item.note || '',
          amount: parseMoneyValue(item.amount),
        }))
      );

      if (addedCount === 0) {
        throw new Error('Dữ liệu trích xuất không có số tiền hợp lệ.');
      }

      setScanSuccessMsg(`Quét thành công! Đã tự động thêm ${addedCount} khoản vào danh sách.`);
      showToast(`AI đã thêm ${addedCount} khoản thanh toán!`);
    } catch (err) {
      console.error('Gemini Vision Scan Error:', err);
      setScanError(
        err.message || 'Không thể phân tích hóa đơn. Vui lòng thử lại với ảnh rõ nét hơn.'
      );
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // ================================================================================
  // TỰ ĐỘNG NHẬN BIẾT ĐÃ CHUYỂN TIỀN (ĐỐI SOÁT BIẾN ĐỘNG SỐ DƯ & ẢNH BIÊN LAI UNC AI)
  // ================================================================================
  const handleAutoReconcileText = () => {
    setVerifyMessage(null);
    const matched = matchBankNotificationText(bankNotifText, aggregatedPeople);
    if (matched.length === 0) {
      setVerifyMessage({
        type: 'error',
        text: 'Không tìm thấy người chưa trả nào khớp với nội dung biến động số dư vừa dán.',
      });
      return;
    }

    const matchedKeys = new Set(matched.map((p) => p.personKey));
    setParticipants((prev) =>
      prev.map((item) =>
        matchedKeys.has(normalizePersonKey(item.name)) ? { ...item, paid: true } : item
      )
    );
    const names = matched.map((p) => `${p.displayName} (${formatVND(p.unpaidAmount)})`).join(', ');
    setBankNotifText('');
    setVerifyMessage({
      type: 'success',
      text: `Đã tự động nhận diện và đánh dấu ĐÃ TRẢ cho: ${names}`,
    });
    showToast(`Tự động gạch nợ thành công ${matched.length} người!`);
  };

  const handleVerifyTransferReceiptImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setVerifyMessage(null);

    if (!hostSettings.geminiApiKey.trim()) {
      setVerifyMessage({
        type: 'error',
        text: 'Cần cấu hình Gemini API Key trong "Cài đặt nhận tiền" để AI đọc ảnh biên lai chuyển khoản.',
      });
      if (appRole === 'host') setIsSettingsOpen(true);
      if (receiptVerifyInputRef.current) receiptVerifyInputRef.current.value = '';
      return;
    }

    setIsVerifyingReceipt(true);
    try {
      const { base64Data, mimeType } = await compressImageToBase64(file);
      const apiKey = hostSettings.geminiApiKey.trim();
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(
        apiKey
      )}`;

      const candidateListText = aggregatedPeople
        .map(
          (p) =>
            `- Tên: "${p.displayName}", Số tiền cần trả: ${p.unpaidAmount}, Nội dung CK chuẩn: "${removeVietnameseTones(
              p.displayName
            )} thanh toan"`
        )
        .join('\n');

      const promptText = `Bạn là hệ thống đối soát biên lai chuyển khoản ngân hàng tự động tại Việt Nam.
Hãy kiểm tra ảnh chụp màn hình biên lai chuyển khoản (UNC) hoặc thông báo biến động số dư này.
Danh sách người đang cần thanh toán:
${candidateListText}

Hãy trích xuất thông tin từ ảnh và đối chiếu xem giao dịch trong ảnh là của ai trong danh sách trên.
Trả về DUY NHẤT một JSON object theo cấu trúc:
{
  "isSuccessTransfer": true,
  "amount": 70000,
  "transferMessage": "Nam thanh toan",
  "matchedPersonNames": ["Nam"]
}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inline_data: { mime_type: mimeType, data: base64Data } },
                { text: promptText },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Lỗi gọi Gemini API (HTTP ${response.status})`);
      }

      const data = await response.json();
      const rawText =
        data?.candidates?.[0]?.content?.parts
          ?.map((p) => p.text || '')
          .join('\n')
          .trim() || '';

      const cleaned = rawText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      const result = JSON.parse(cleaned);

      if (!result?.isSuccessTransfer) {
        throw new Error('Ảnh tải lên không phải là biên lai chuyển khoản thành công.');
      }

      const aiMatchedKeys = new Set(
        (result.matchedPersonNames || []).map((n) => normalizePersonKey(n))
      );

      // Dự phòng đối chiếu thêm bằng nội dung chuyển khoản & số tiền
      const detectedAmt = parseMoneyValue(result.amount);
      const fallbackMatched = matchBankNotificationText(
        `${result.transferMessage || ''} +${detectedAmt}`,
        aggregatedPeople
      );
      fallbackMatched.forEach((p) => aiMatchedKeys.add(p.personKey));

      const matchedPeople = aggregatedPeople.filter((p) => aiMatchedKeys.has(p.personKey));
      if (matchedPeople.length === 0) {
        throw new Error(
          `AI đọc được giao dịch ${formatVND(detectedAmt)} (${
            result.transferMessage || 'không rõ nội dung'
          }) nhưng không khớp với tên người nào trong danh sách.`
        );
      }

      setParticipants((prev) =>
        prev.map((item) =>
          aiMatchedKeys.has(normalizePersonKey(item.name)) ? { ...item, paid: true } : item
        )
      );

      const summary = matchedPeople.map((p) => p.displayName).join(', ');
      setVerifyMessage({
        type: 'success',
        text: `AI đã xác nhận biên lai chuyển khoản (${formatVND(
          detectedAmt
        )}) và tự động gạch nợ cho: ${summary}!`,
      });
      showToast(`Đã tự động xác nhận thanh toán cho ${summary}!`);
    } catch (err) {
      setVerifyMessage({
        type: 'error',
        text: err.message || 'Không thể xác thực ảnh biên lai chuyển khoản.',
      });
    } finally {
      setIsVerifyingReceipt(false);
      if (receiptVerifyInputRef.current) receiptVerifyInputRef.current.value = '';
    }
  };

  // Thao tác trạng thái theo từng khoản lẻ (item)
  const toggleItemPaidStatus = (id) => {
    setParticipants((prev) =>
      prev.map((p) => (p.id === id ? { ...p, paid: !p.paid } : p))
    );
  };

  // Thao tác trạng thái theo từng người (tất cả các khoản của người đó)
  const togglePersonPaidStatus = (personKey, targetPaidState) => {
    setParticipants((prev) =>
      prev.map((p) =>
        normalizePersonKey(p.name) === personKey ? { ...p, paid: targetPaidState } : p
      )
    );
  };

  const removeParticipantItem = (id) => {
    setParticipants((prev) => prev.filter((p) => p.id !== id));
    if (qrTarget?.mode === 'item' && qrTarget.id === id) {
      closeQrModal();
    }
  };

  const removePersonGroup = (personKey) => {
    setParticipants((prev) => prev.filter((p) => normalizePersonKey(p.name) !== personKey));
    if (qrTarget?.mode === 'person' && qrTarget.personKey === personKey) {
      closeQrModal();
    }
  };

  const clearAllParticipants = () => {
    if (participants.length === 0) return;
    setParticipants([]);
    showToast('Đã xoá toàn bộ danh sách!');
  };

  const markAllPaid = () => {
    setParticipants((prev) => prev.map((p) => ({ ...p, paid: true })));
    showToast('Đã đánh dấu tất cả là Đã trả!');
  };

  // Đồng bộ dữ liệu hiển thị trong Modal QR
  const liveQrData = useMemo(() => {
    if (!qrTarget) return null;
    if (qrTarget.mode === 'person') {
      const group = aggregatedPeople.find((g) => g.personKey === qrTarget.personKey);
      if (!group) return null;
      return {
        mode: 'person',
        personKey: group.personKey,
        name: group.displayName,
        amount: group.qrAmount,
        totalAmount: group.totalAmount,
        unpaidAmount: group.unpaidAmount,
        paid: group.allPaid,
        items: group.items,
      };
    } else {
      const item = participants.find((p) => p.id === qrTarget.id);
      if (!item) return null;
      return {
        mode: 'item',
        id: item.id,
        name: item.name,
        amount: item.amount,
        paid: item.paid,
        items: [item],
      };
    }
  }, [qrTarget, aggregatedPeople, participants]);

  const selectedBankInfo = useMemo(
    () =>
      VIETQR_BANKS.find(
        (b) => b.bin === hostSettings.bankBin || b.code === hostSettings.bankBin
      ),
    [hostSettings.bankBin]
  );

  const activeQrUrl = useMemo(() => {
    if (!liveQrData) return '';
    return buildVietQrUrl({
      bankBin: hostSettings.bankBin,
      accountNumber: hostSettings.accountNumber,
      accountName: hostSettings.accountName,
      amount: liveQrData.amount,
      participantName: liveQrData.name,
    });
  }, [liveQrData, hostSettings]);

  const handleCopyText = async (text, label) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(String(text));
      showToast(`Đã sao chép ${label}!`);
    } catch {
      showToast('Không thể sao chép tự động.');
    }
  };

  const handleCopyQrLink = async () => {
    if (!activeQrUrl) return;
    try {
      await navigator.clipboard.writeText(activeQrUrl);
      setQrCopied(true);
      showToast('Đã sao chép đường dẫn ảnh QR!');
      setTimeout(() => setQrCopied(false), 2500);
    } catch {
      showToast('Không thể sao chép tự động.');
    }
  };

  const handleDownloadQrImage = async () => {
    if (!activeQrUrl || !liveQrData) return;
    setIsDownloadingQr(true);
    try {
      const res = await fetch(activeQrUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `VietQR-${removeVietnameseTones(liveQrData.name) || 'Payment'}-${liveQrData.amount}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
      showToast('Đã tải ảnh mã QR về máy!');
    } catch {
      window.open(activeQrUrl, '_blank', 'noopener,noreferrer');
    } finally {
      setIsDownloadingQr(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16 font-sans selection:bg-indigo-600 selection:text-white">
      {/* Input ẩn dùng chung cho tính năng tải ảnh biên lai UNC tự động gạch nợ */}
      <input
        ref={receiptVerifyInputRef}
        type="file"
        accept="image/*"
        onChange={handleVerifyTransferReceiptImage}
        className="hidden"
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-700 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Thanh chuyển đổi 2 Giao diện (Ẩn nếu người trả tiền mở từ Link chia sẻ ?share=...) */}
      {!sharedUrlParams.isSharedLink && (
        <div className="bg-slate-900 text-slate-200 border-b border-slate-800">
          <div className="max-w-3xl mx-auto px-4 py-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400 font-medium">Chế độ hiển thị:</span>
              <div className="inline-flex rounded-xl bg-slate-800 p-0.5 border border-slate-700">
                <button
                  type="button"
                  onClick={() => setAppRole('host')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    appRole === 'host'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Giao diện của tôi (Chủ trì)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAppRole('payer')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    appRole === 'payer'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Giao diện Người trả tiền</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleCopyShareLink()}
                className="inline-flex items-center gap-1.5 text-xs font-semibold bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 px-3 py-1.5 rounded-xl border border-indigo-400/30 transition"
                title="Sao chép đường dẫn rút gọn chỉ hiển thị giao diện Người trả tiền để gửi vào nhóm Zalo"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Copy Link gửi nhóm</span>
              </button>

              <button
                type="button"
                onClick={handleCopyZaloSummaryMessage}
                className="inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 px-3 py-1.5 rounded-xl border border-emerald-400/30 transition"
                title="Sao chép tin nhắn tổng hợp danh sách từng người kèm link để dán ngay vào Zalo"
              >
                <MessageSquareText className="w-3.5 h-3.5" />
                <span>Copy tin nhắn Zalo kèm Link</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================== */}
      {/* GIAO DIỆN 2: NGƯỜI TRẢ TIỀN (KHÔNG CÓ NÚT SETUP / CÀI ĐẶT / CHỈNH SỬA)    */}
      {/* ======================================================================== */}
      {appRole === 'payer' ? (
        <>
          <header className="bg-gradient-to-br from-emerald-700 via-teal-600 to-cyan-700 text-white shadow-lg">
            <div className="max-w-2xl mx-auto px-4 pt-6 pb-8">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20">
                  <QrCode className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                    Thanh Toán Tiền Đồ Ăn / Thức Uống
                  </h1>
                  <p className="text-emerald-100 text-xs sm:text-sm">
                    Chọn tên của bạn bên dưới và bấm <strong>Quét mã QR</strong> để chuyển khoản chính xác
                  </p>
                </div>
              </div>

              {/* Thẻ Thông tin tài khoản nhận tiền (Chỉ xem & Sao chép STK) */}
              {hostSettings.bankBin && hostSettings.accountNumber ? (
                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-[11px] uppercase tracking-wider text-emerald-200 font-semibold">
                      Tài khoản nhận tiền
                    </span>
                    <p className="text-sm sm:text-base font-bold text-white">
                      {selectedBankInfo?.name || `Ngân hàng BIN ${hostSettings.bankBin}`}
                    </p>
                    <p className="text-xs sm:text-sm text-emerald-100">
                      STK: <strong className="font-mono text-white">{hostSettings.accountNumber}</strong>
                      {hostSettings.accountName ? ` • ${hostSettings.accountName}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyText(hostSettings.accountNumber, 'Số tài khoản')}
                    className="self-start sm:self-center inline-flex items-center gap-1.5 bg-white text-emerald-800 hover:bg-emerald-50 font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs transition shrink-0"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Sao chép STK</span>
                  </button>
                </div>
              ) : (
                <div className="bg-amber-500/25 border border-amber-300/40 rounded-2xl p-3.5 text-xs text-amber-100">
                  Chủ trì chưa cập nhật số tài khoản nhận tiền.
                </div>
              )}
            </div>
          </header>

          <main className="max-w-2xl mx-auto px-4 -mt-4 space-y-4">
            {/* Khung tìm kiếm & Chọn nhanh tên của mình */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={payerSearchQuery}
                  onChange={(e) => setPayerSearchQuery(e.target.value)}
                  placeholder="Tìm tên của bạn (VD: anh Tài, anh Hà, anh Thành, Linh...)"
                  className="w-full rounded-xl border border-slate-300 pl-10 pr-9 py-2.5 text-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                />
                {payerSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setPayerSearchQuery('')}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Chips chọn nhanh tên người */}
              {aggregatedPeople.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-medium text-slate-500 mr-1">
                    Chọn nhanh tên bạn:
                  </span>
                  <button
                    type="button"
                    onClick={() => setPayerSearchQuery('')}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition ${
                      !payerSearchQuery
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200/70'
                    }`}
                  >
                    Tất cả ({aggregatedPeople.length})
                  </button>
                  {aggregatedPeople.map((person) => {
                    const isSelected =
                      normalizePersonKey(payerSearchQuery) === person.personKey;
                    return (
                      <button
                        key={person.personKey}
                        type="button"
                        onClick={() =>
                          setPayerSearchQuery(isSelected ? '' : person.displayName)
                        }
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : person.allPaid
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700'
                        }`}
                      >
                        {person.displayName} ({formatVND(person.qrAmount)})
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Danh sách số tiền cần trả theo từng người (Chỉ đọc + Nút Quét QR) */}
            <section className="space-y-3">
              {payerFilteredPeople.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-10 text-center space-y-2">
                  <Users className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-sm font-semibold text-slate-700">
                    Không tìm thấy tên phù hợp
                  </p>
                </div>
              ) : (
                payerFilteredPeople.map((person) => (
                  <div
                    key={person.personKey}
                    className={`bg-white rounded-2xl shadow-sm border p-4 sm:p-5 transition ${
                      person.allPaid
                        ? 'border-emerald-200 bg-emerald-50/20'
                        : 'border-slate-200/90 hover:border-emerald-300'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-extrabold text-slate-900">
                            {person.displayName}
                          </h3>
                          <span
                            className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                              person.allPaid
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                : 'bg-amber-100 text-amber-800 border-amber-200'
                            }`}
                          >
                            {person.allPaid ? '✓ Đã thanh toán' : 'Chưa thanh toán'}
                          </span>
                        </div>

                        {/* Chi tiết các món đã đặt */}
                        <div className="flex flex-wrap gap-1.5">
                          {person.items.map((subItem, idx) => (
                            <span
                              key={subItem.id}
                              className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200"
                            >
                              <span>{subItem.note || `Món #${idx + 1}`}:</span>
                              <strong className="text-slate-900">
                                {formatVND(subItem.amount)}
                              </strong>
                            </span>
                          ))}
                        </div>

                        <div className="pt-1">
                          <span className="text-xs text-slate-500">
                            {person.allPaid ? 'Tổng đã thanh toán: ' : 'Tổng số tiền cần chuyển: '}
                          </span>
                          <span className="text-xl font-black text-emerald-700">
                            {formatVND(person.qrAmount)}
                          </span>
                        </div>
                      </div>

                      {/* Nút mở QR thanh toán lớn cho Người trả tiền */}
                      <div className="shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            openQrModal({
                              mode: 'person',
                              personKey: person.personKey,
                            })
                          }
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-sm px-5 py-3 rounded-xl shadow-sm transition"
                        >
                          <QrCode className="w-5 h-5" />
                          <span>Quét mã QR thanh toán</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </section>
          </main>
        </>
      ) : (
        /* ======================================================================== */
        /* GIAO DIỆN 1: CHỦ TRÌ ("GIAO DIỆN CỦA TÔI" - ĐẦY ĐỦ QUẢN LÝ & CÀI ĐẶT)     */
        /* ======================================================================== */
        <>
          <header className="bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-700 text-white shadow-lg">
            <div className="max-w-3xl mx-auto px-4 pt-6 pb-8">
              <div className="flex items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
                    <Receipt className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                      Sổ Thu Tiền & Tạo VietQR (Chủ Trì)
                    </h1>
                    <p className="text-indigo-100 text-xs sm:text-sm">
                      Tự động tổng hợp tiền theo từng người, tách tin nhắn Zalo & đối soát tự động
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsSettingsOpen((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium bg-white/15 hover:bg-white/25 active:scale-95 transition px-3.5 py-2 rounded-xl border border-white/20 backdrop-blur-sm"
                >
                  <Settings className="w-4 h-4" />
                  <span>Cài đặt</span>
                  {isSettingsOpen ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* 3 Header Stat Cards */}
              <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
                <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-3 sm:p-4">
                  <div className="flex items-center gap-1.5 text-indigo-100 text-xs font-medium mb-1">
                    <Wallet className="w-3.5 h-3.5 shrink-0" />
                    <span>Tổng thu</span>
                  </div>
                  <p className="text-base sm:text-2xl font-extrabold tracking-tight truncate">
                    {formatVND(stats.total)}
                  </p>
                  <p className="text-[11px] text-indigo-200 mt-0.5">
                    {stats.totalPeopleCount} người ({participants.length} khoản)
                  </p>
                </div>

                <div className="bg-emerald-500/20 backdrop-blur-md border border-emerald-300/30 rounded-2xl p-3 sm:p-4">
                  <div className="flex items-center gap-1.5 text-emerald-100 text-xs font-medium mb-1">
                    <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                    <span>Đã thu</span>
                  </div>
                  <p className="text-base sm:text-2xl font-extrabold tracking-tight text-emerald-200 truncate">
                    {formatVND(stats.collected)}
                  </p>
                  <p className="text-[11px] text-emerald-100/90 mt-0.5">
                    {stats.paidPeopleCount}/{stats.totalPeopleCount} người hoàn tất
                  </p>
                </div>

                <div className="bg-amber-500/20 backdrop-blur-md border border-amber-300/30 rounded-2xl p-3 sm:p-4">
                  <div className="flex items-center gap-1.5 text-amber-100 text-xs font-medium mb-1">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span>Còn lại</span>
                  </div>
                  <p className="text-base sm:text-2xl font-extrabold tracking-tight text-amber-200 truncate">
                    {formatVND(stats.remaining)}
                  </p>
                  <p className="text-[11px] text-amber-100/90 mt-0.5">
                    {stats.totalPeopleCount - stats.paidPeopleCount} người còn thiếu
                  </p>
                </div>
              </div>

              {/* Thanh tiến độ thu tiền */}
              <div className="mt-4">
                <div className="flex justify-between text-xs text-indigo-100 mb-1.5 font-medium">
                  <span>Tiến độ hoàn thành</span>
                  <span>{stats.progressPercent}%</span>
                </div>
                <div className="w-full h-2 bg-indigo-950/40 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 to-teal-300 transition-all duration-500 rounded-full"
                    style={{ width: `${stats.progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </header>

          <main className="max-w-3xl mx-auto px-4 -mt-4 space-y-5">
            {/* PHASE 1: COLLAPSIBLE HOST SETTINGS CARD ("Cài đặt nhận tiền") */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
              <button
                type="button"
                onClick={() => setIsSettingsOpen((prev) => !prev)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50/80 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-slate-800 text-sm sm:text-base">
                        Cài đặt nhận tiền (Chủ trì)
                      </h2>
                      {hostSettings.bankBin && hostSettings.accountNumber ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Check className="w-3 h-3" /> Đã cấu hình VietQR
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          Cần nhập STK
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {hostSettings.accountNumber
                        ? `${selectedBankInfo?.code || hostSettings.bankBin} • ${
                            hostSettings.accountNumber
                          } ${hostSettings.accountName ? `(${hostSettings.accountName})` : ''}`
                        : 'Thiết lập tài khoản ngân hàng & Gemini API Key (tự động lưu trên trình duyệt)'}
                    </p>
                  </div>
                </div>
                <div className="text-slate-400">
                  {isSettingsOpen ? (
                    <ChevronUp className="w-5 h-5" />
                  ) : (
                    <ChevronDown className="w-5 h-5" />
                  )}
                </div>
              </button>

              {isSettingsOpen && (
                <div className="px-5 pb-5 pt-2 border-t border-slate-100 bg-slate-50/50 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Ngân hàng (Bank BIN) */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Ngân hàng thụ hưởng (Mã BIN / VietQR)
                      </label>
                      <div className="relative">
                        <select
                          value={
                            VIETQR_BANKS.some((b) => b.bin === hostSettings.bankBin)
                              ? hostSettings.bankBin
                              : 'CUSTOM'
                          }
                          onChange={(e) => {
                            if (e.target.value !== 'CUSTOM') {
                              setHostSettings((prev) => ({ ...prev, bankBin: e.target.value }));
                            }
                          }}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                        >
                          {VIETQR_BANKS.map((bank) => (
                            <option key={bank.bin} value={bank.bin}>
                              {bank.code} ({bank.bin}) - {bank.name.split(' - ')[1]}
                            </option>
                          ))}
                          <option value="CUSTOM">Nhập mã BIN / Tên ngân hàng khác...</option>
                        </select>
                      </div>
                      <input
                        type="text"
                        value={hostSettings.bankBin}
                        onChange={(e) =>
                          setHostSettings((prev) => ({ ...prev, bankBin: e.target.value }))
                        }
                        placeholder="Mã BIN hoặc mã ngân hàng (VD: 970436 hoặc VCB)"
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-600 focus:border-indigo-500 outline-none"
                      />
                    </div>

                    {/* Số tài khoản */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Số tài khoản nhận tiền
                      </label>
                      <div className="relative">
                        <CreditCard className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                        <input
                          type="text"
                          value={hostSettings.accountNumber}
                          onChange={(e) =>
                            setHostSettings((prev) => ({
                              ...prev,
                              accountNumber: e.target.value.replace(/\s+/g, ''),
                            }))
                          }
                          placeholder="Nhập số tài khoản ngân hàng..."
                          className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3.5 py-2.5 text-sm text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                        />
                      </div>
                    </div>

                    {/* Tên chủ tài khoản */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Tên chủ tài khoản (Không dấu, in hoa)
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                        <input
                          type="text"
                          value={hostSettings.accountName}
                          onChange={(e) =>
                            setHostSettings((prev) => ({
                              ...prev,
                              accountName: removeVietnameseTones(e.target.value).toUpperCase(),
                            }))
                          }
                          placeholder="VD: NGUYEN VAN A"
                          className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3.5 py-2.5 text-sm uppercase text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                        />
                      </div>
                    </div>

                    {/* Gemini API Key */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Gemini API Key (Quét hóa đơn & Tự động đọc biên lai UNC)
                      </label>
                      <div className="relative">
                        <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                        <input
                          type={showApiKey ? 'text' : 'password'}
                          value={hostSettings.geminiApiKey}
                          onChange={(e) =>
                            setHostSettings((prev) => ({
                              ...prev,
                              geminiApiKey: e.target.value,
                            }))
                          }
                          placeholder="AIzaSy..."
                          className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-10 py-2.5 text-sm text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey((prev) => !prev)}
                          className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-0.5"
                          title={showApiKey ? 'Ẩn API Key' : 'Hiện API Key'}
                        >
                          {showApiKey ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-xs text-slate-500">
                    <span>
                      🔒 Mọi thông tin chỉ lưu cục bộ trong <code>localStorage</code> của trình
                      duyệt.
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSettingsOpen(false);
                        showToast('Đã lưu cài đặt nhận tiền!');
                      }}
                      className="font-semibold text-indigo-600 hover:text-indigo-700"
                    >
                      Thu gọn cài đặt
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* PHASE 2: INPUT & AUTO-VERIFICATION ENGINE (4 TABS) */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
              {/* Tab Navigation Header */}
              <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-slate-200 bg-slate-100/70 p-1.5 gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveTab('manual')}
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-2.5 rounded-xl text-xs sm:text-sm font-semibold transition ${
                    activeTab === 'manual'
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <UserPlus className="w-4 h-4 shrink-0" />
                  <span>Nhập tay</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('paste')}
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-2.5 rounded-xl text-xs sm:text-sm font-semibold transition ${
                    activeTab === 'paste'
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <MessageSquareText className="w-4 h-4 shrink-0" />
                  <span>Dán tin nhắn Zalo</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('ai')}
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-2.5 rounded-xl text-xs sm:text-sm font-semibold transition ${
                    activeTab === 'ai'
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>Quét bill AI</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('reconcile')}
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-2.5 rounded-xl text-xs sm:text-sm font-semibold transition ${
                    activeTab === 'reconcile'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  <BellRing className="w-4 h-4 shrink-0" />
                  <span>Tự động gạch nợ</span>
                </button>
              </div>

              <div className="p-5">
                {/* TAB 1: NHẬP TAY (MANUAL) */}
                {activeTab === 'manual' && (
                  <form onSubmit={handleManualSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                            Tên đồng nghiệp / Người đặt
                          </label>
                          <input
                            type="text"
                            value={manualName}
                            onChange={(e) => setManualName(e.target.value)}
                            placeholder="VD: anh Tài, anh Hà, anh Thành, Linh..."
                            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                            Ghi chú món (Tuỳ chọn - tự động cộng dồn nếu trùng tên)
                          </label>
                          <input
                            type="text"
                            value={manualNote}
                            onChange={(e) => setManualNote(e.target.value)}
                            placeholder="VD: Cơm sườn, Trà đào..."
                            className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-700 focus:border-indigo-500 outline-none"
                          />
                        </div>

                        {/* Saved Teammates Chips */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-medium text-slate-500">
                              Chọn nhanh đồng nghiệp:
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowAddTeammate((prev) => !prev)}
                              className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-0.5"
                            >
                              <Plus className="w-3 h-3" /> Thêm tên quen
                            </button>
                          </div>

                          {showAddTeammate && (
                            <div className="flex gap-1.5 mb-2">
                              <input
                                type="text"
                                value={newTeammateInput}
                                onChange={(e) => setNewTeammateInput(e.target.value)}
                                placeholder="Nhập tên muốn lưu..."
                                className="flex-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs outline-none focus:border-indigo-500"
                              />
                              <button
                                type="button"
                                onClick={handleAddTeammateChip}
                                className="bg-indigo-600 text-white text-xs font-semibold px-3 py-1 rounded-lg hover:bg-indigo-700"
                              >
                                Lưu
                              </button>
                            </div>
                          )}

                          <div className="flex flex-wrap gap-1.5">
                            {savedTeammates.map((teammate) => {
                              const isSelected =
                                normalizePersonKey(manualName) === normalizePersonKey(teammate);
                              return (
                                <span
                                  key={teammate}
                                  className={`inline-flex items-center gap-1 rounded-full text-xs font-medium px-2.5 py-1 border transition cursor-pointer select-none ${
                                    isSelected
                                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                      : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200'
                                  }`}
                                  onClick={() => setManualName(teammate)}
                                >
                                  <span>{teammate}</span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveTeammateChip(teammate);
                                    }}
                                    className={`rounded-full p-0.5 hover:bg-black/10 ${
                                      isSelected ? 'text-indigo-100' : 'text-slate-400'
                                    }`}
                                    title={`Xoá ${teammate} khỏi danh sách gợi ý`}
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Ô nhập Số tiền */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Số tiền cần thu (VNĐ)
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={manualAmount}
                          onChange={(e) => setManualAmount(e.target.value)}
                          placeholder="VD: 75815 hoặc 45.000 hoặc 50k..."
                          className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                        />

                        {/* Quick Amount Buttons (30k -> 60k) */}
                        <div className="mt-2.5">
                          <span className="block text-[11px] font-medium text-slate-500 mb-1.5">
                            Chọn mức tiền nhanh:
                          </span>
                          <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                            {QUICK_AMOUNTS.map((item) => {
                              const isSelected = Number(manualAmount) === item.value;
                              return (
                                <button
                                  key={item.value}
                                  type="button"
                                  onClick={() => setManualAmount(String(item.value))}
                                  className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition active:scale-95 ${
                                    isSelected
                                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200'
                                  }`}
                                >
                                  {item.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-1 flex justify-end">
                      <button
                        type="submit"
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-semibold text-sm px-6 py-2.5 rounded-xl shadow-sm transition"
                      >
                        <UserPlus className="w-4 h-4" />
                        <span>Thêm vào danh sách</span>
                      </button>
                    </div>
                  </form>
                )}

                {/* TAB 2: DÁN TIN NHẮN ZALO (SMART PASTE) */}
                {activeTab === 'paste' && (
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-slate-700">
                          Dán nội dung tin nhắn từ nhóm Zalo / Messenger / Slack
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setChatLogText(
                              'anh Tài: cơm sườn 45k + trà đào 25k\nanh Hà 50k\nanh Thành: bún chả 45.000đ - Linh (bún bò) 50 cành'
                            )
                          }
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                        >
                          Dùng dữ liệu mẫu (nhiều món/người)
                        </button>
                      </div>
                      <textarea
                        rows={4}
                        value={chatLogText}
                        onChange={(e) => setChatLogText(e.target.value)}
                        placeholder="Ví dụ: anh Tài: cơm 45k + trà đào 25k, anh Hà 50k, anh Thành 45.000đ - Linh 50 cành..."
                        className="w-full rounded-xl border border-slate-300 p-3.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none resize-y"
                      />
                      <p className="text-[11px] text-slate-500 mt-1">
                        Hỗ trợ tách tên người & tên món (VD: <code>anh Tài: cơm 45k + trà 25k</code>,{' '}
                        <code>45k5</code>, <code>45 rưỡi</code>, <code>1 lít 2</code>) để tự động
                        gộp tổng tiền theo từng người.
                      </p>
                    </div>

                    {parsedPreview.length > 0 && (
                      <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3.5">
                        <p className="text-xs font-semibold text-indigo-900 mb-2">
                          Đã nhận diện tự động ({parsedPreview.length} khoản):
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {parsedPreview.map((item, idx) => (
                            <span
                              key={`${item.name}-${idx}`}
                              className="inline-flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg text-xs font-medium text-slate-700 border border-indigo-200 shadow-2xs"
                            >
                              <span className="font-semibold text-slate-900">
                                {item.name}
                                {item.note ? ` (${item.note})` : ''}:
                              </span>
                              <span className="text-indigo-600 font-bold">
                                {formatVND(item.amount)}
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleSmartPasteImport}
                        disabled={parsedPreview.length === 0}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold text-sm px-6 py-2.5 rounded-xl shadow-sm transition"
                      >
                        <MessageSquareText className="w-4 h-4" />
                        <span>
                          Tách & Thêm{' '}
                          {parsedPreview.length > 0 ? `(${parsedPreview.length} khoản)` : ''}
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {/* TAB 3: QUÉT ẢNH HÓA ĐƠN BẰNG AI (GEMINI VISION SCANNER) */}
                {activeTab === 'ai' && (
                  <div className="space-y-4">
                    <div
                      onClick={() => !isScanning && fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-2xl p-6 text-center transition cursor-pointer ${
                        isScanning
                          ? 'border-indigo-300 bg-indigo-50/40 cursor-wait'
                          : 'border-slate-300 hover:border-indigo-500 hover:bg-indigo-50/30'
                      }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />

                      {isScanning ? (
                        <div className="py-4 flex flex-col items-center justify-center space-y-3">
                          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                          <div>
                            <p className="text-sm font-bold text-indigo-900">
                              AI đang đọc hóa đơn & bóc tách số tiền...
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Đang gọi Gemini Vision ({GEMINI_MODEL}) để trích xuất JSON
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="py-2 flex flex-col items-center justify-center space-y-2.5">
                          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                            <Upload className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-800">
                              Nhấn để chọn ảnh hóa đơn hoặc ảnh chụp màn hình đơn hàng
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              Hỗ trợ bill GrabFood, ShopeeFood, bill giấy quán ăn (Tự động nén ảnh
                              tốc độ cao)
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {scanPreviewUrl && (
                      <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <img
                          src={scanPreviewUrl}
                          alt="Bill preview"
                          className="w-14 h-14 object-cover rounded-lg border border-slate-300 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-700 truncate">
                            Ảnh hóa đơn đã tải lên
                          </p>
                          <p className="text-[11px] text-slate-500">
                            AI tự động chuyển đổi sang mảng JSON và cộng dồn theo tên người
                          </p>
                        </div>
                        {!isScanning && (
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200"
                          >
                            <RefreshCw className="w-3.5 h-3.5" /> Quét ảnh khác
                          </button>
                        )}
                      </div>
                    )}

                    {scanError && (
                      <div className="flex items-start gap-2.5 bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl text-xs">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-semibold">Lỗi quét hóa đơn AI</p>
                          <p className="mt-0.5">{scanError}</p>
                        </div>
                      </div>
                    )}

                    {scanSuccessMsg && (
                      <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-xl text-xs font-medium">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{scanSuccessMsg}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 4: TỰ ĐỘNG NHẬN BIẾT ĐÃ CHUYỂN TIỀN (AUTO PAYMENT RECONCILIATION) */}
                {activeTab === 'reconcile' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Cách 1: Dán SMS / Thông báo biến động số dư ngân hàng */}
                      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <BellRing className="w-4 h-4 text-emerald-600" />
                            <span>Cách 1: Dán thông báo biến động số dư</span>
                          </h3>
                          <button
                            type="button"
                            onClick={() =>
                              setBankNotifText(
                                'TK 0123456789 +70,000VND luc 14:30. ND: anh Tai thanh toan'
                              )
                            }
                            className="text-[11px] font-semibold text-emerald-600 hover:underline"
                          >
                            Dán mẫu thử
                          </button>
                        </div>
                        <textarea
                          rows={3}
                          value={bankNotifText}
                          onChange={(e) => setBankNotifText(e.target.value)}
                          placeholder="Dán tin nhắn SMS / thông báo biến động số dư từ app ngân hàng (VD: +70,000VND ND: anh Tai thanh toan)..."
                          className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs focus:border-emerald-600 outline-none resize-none"
                        />
                        <button
                          type="button"
                          onClick={handleAutoReconcileText}
                          disabled={!bankNotifText.trim()}
                          className="w-full inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-semibold text-xs py-2.5 px-4 rounded-xl transition"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Đối soát & Tự động gạch nợ</span>
                        </button>
                      </div>

                      {/* Cách 2: Tải ảnh chụp biên lai chuyển khoản (UNC) để AI tự động gạch nợ */}
                      <div
                        onClick={() =>
                          !isVerifyingReceipt && receiptVerifyInputRef.current?.click()
                        }
                        className="bg-emerald-50/50 hover:bg-emerald-50 border-2 border-dashed border-emerald-300 rounded-2xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition space-y-2.5"
                      >
                        {isVerifyingReceipt ? (
                          <>
                            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
                            <p className="text-xs font-bold text-emerald-900">
                              AI đang đọc ảnh biên lai CK & tự động gạch nợ...
                            </p>
                          </>
                        ) : (
                          <>
                            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                              <FileCheck2 className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-800">
                                Cách 2: Quét ảnh biên lai chuyển khoản (UNC) bằng AI
                              </p>
                              <p className="text-[11px] text-slate-500 mt-1">
                                Tải ảnh chụp màn hình chuyển tiền thành công mà đồng nghiệp gửi — AI
                                sẽ tự nhận biết số tiền + tên người và đánh dấu <strong>Đã trả</strong>
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {verifyMessage && (
                      <div
                        className={`flex items-start gap-2.5 p-3.5 rounded-xl text-xs border ${
                          verifyMessage.type === 'success'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-rose-50 border-rose-200 text-rose-800'
                        }`}
                      >
                        {verifyMessage.type === 'success' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        )}
                        <span className="font-medium">{verifyMessage.text}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* PHASE 3: TRACKING DASHBOARD & PER-PERSON AGGREGATION */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="font-bold text-slate-800 text-base">
                      {viewMode === 'grouped'
                        ? `Tổng hợp theo từng người (${filteredPeople.length} người)`
                        : `Danh sách từng khoản lẻ (${filteredItems.length} khoản)`}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {viewMode === 'grouped'
                        ? 'Tự động cộng dồn nhiều món của cùng một người & xuất 1 mã VietQR tổng'
                        : 'Hiển thị chi tiết từng dòng theo thứ tự nhập'}
                    </p>
                  </div>

                  {/* Chuyển chế độ xem: Tổng hợp theo người vs Từng khoản lẻ */}
                  <div className="inline-flex rounded-xl bg-indigo-50/80 p-1 text-xs font-semibold border border-indigo-100 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setViewMode('grouped')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                        viewMode === 'grouped'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'text-indigo-700 hover:bg-indigo-100/60'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Tổng hợp theo người</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('items')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                        viewMode === 'items'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'text-indigo-700 hover:bg-indigo-100/60'
                      }`}
                    >
                      <List className="w-3.5 h-3.5" />
                      <span>Từng khoản lẻ</span>
                    </button>
                  </div>
                </div>

                {/* Bộ lọc trạng thái & Thao tác hàng loạt */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setFilterStatus('all')}
                      className={`px-2.5 py-1 rounded-lg transition ${
                        filterStatus === 'all'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Tất cả
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterStatus('unpaid')}
                      className={`px-2.5 py-1 rounded-lg transition ${
                        filterStatus === 'unpaid'
                          ? 'bg-white text-amber-700 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Chưa trả
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterStatus('paid')}
                      className={`px-2.5 py-1 rounded-lg transition ${
                        filterStatus === 'paid'
                          ? 'bg-white text-emerald-700 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Đã trả
                    </button>
                  </div>

                  {participants.length > 0 && (
                    <div className="flex items-center gap-1">
                      {aggregatedPeople.some((p) => p.items.length > 1) && (
                        <button
                          type="button"
                          onClick={mergeDuplicatePeopleEntries}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition"
                          title="Gộp vĩnh viễn các dòng của cùng một người thành 1 dòng"
                        >
                          <Combine className="w-3.5 h-3.5" />
                          <span>Gộp dòng trùng</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={markAllPaid}
                        className="text-xs font-semibold text-emerald-600 hover:bg-emerald-50 px-2.5 py-1.5 rounded-lg transition"
                      >
                        Thu hết
                      </button>
                      <button
                        type="button"
                        onClick={clearAllParticipants}
                        className="text-xs font-semibold text-rose-600 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg transition"
                      >
                        Xoá hết
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* DANH SÁCH CHẾ ĐỘ 1: TỔNG HỢP THEO TỪNG NGƯỜI (GROUPED VIEW) */}
              {viewMode === 'grouped' ? (
                filteredPeople.length === 0 ? (
                  <div className="p-10 text-center space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                      <Users className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700">
                      Chưa có người tham gia nào trong mục này
                    </p>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Khi một người đặt nhiều món (VD: cơm trưa + trà chiều), hệ thống sẽ tự động
                      cộng dồn tổng tiền tại đây.
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {filteredPeople.map((person) => (
                      <li
                        key={person.personKey}
                        className={`px-5 py-4 transition ${
                          person.allPaid ? 'bg-emerald-50/25' : 'hover:bg-slate-50/70'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-start gap-3.5 min-w-0">
                            <button
                              type="button"
                              onClick={() =>
                                togglePersonPaidStatus(person.personKey, !person.allPaid)
                              }
                              className={`mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center border transition shrink-0 ${
                                person.allPaid
                                  ? 'bg-emerald-500 border-emerald-500 text-white shadow-2xs'
                                  : 'border-slate-300 bg-white hover:border-indigo-500'
                              }`}
                              aria-label={`Đánh dấu tất cả khoản của ${person.displayName}`}
                            >
                              {person.allPaid && <Check className="w-4 h-4 stroke-[3]" />}
                            </button>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p
                                  className={`font-bold text-base truncate ${
                                    person.allPaid ? 'line-through text-slate-400' : 'text-slate-900'
                                  }`}
                                >
                                  {person.displayName}
                                </p>

                                {person.items.length > 1 && (
                                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    {person.items.length} khoản
                                  </span>
                                )}

                                <button
                                  type="button"
                                  onClick={() =>
                                    togglePersonPaidStatus(person.personKey, !person.allPaid)
                                  }
                                  className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border transition ${
                                    person.allPaid
                                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                      : person.partiallyPaid
                                      ? 'bg-sky-100 text-sky-800 border-sky-200'
                                      : 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200/70'
                                  }`}
                                >
                                  {person.allPaid
                                    ? 'Đã trả đủ'
                                    : person.partiallyPaid
                                    ? `Đã trả 1 phần (${formatVND(person.paidAmount)})`
                                    : 'Chưa trả'}
                                </button>
                              </div>

                              <div className="flex flex-wrap items-baseline gap-2 mt-1">
                                <span
                                  className={`text-base font-extrabold ${
                                    person.allPaid ? 'text-emerald-600/70' : 'text-indigo-600'
                                  }`}
                                >
                                  {person.allPaid
                                    ? `Tổng: ${formatVND(person.totalAmount)}`
                                    : `Cần thu: ${formatVND(person.unpaidAmount)}`}
                                </span>
                                {person.partiallyPaid && (
                                  <span className="text-xs text-slate-500">
                                    (Tổng đặt: {formatVND(person.totalAmount)})
                                  </span>
                                )}
                              </div>

                              {/* Danh sách các khoản/món con của người này */}
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {person.items.map((subItem, idx) => (
                                  <div
                                    key={subItem.id}
                                    className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition ${
                                      subItem.paid
                                        ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800 line-through opacity-75'
                                        : 'bg-slate-100/80 border-slate-200 text-slate-700'
                                    }`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => toggleItemPaidStatus(subItem.id)}
                                      className="hover:underline font-medium text-left"
                                      title="Bấm để đổi trạng thái Đã trả / Chưa trả cho riêng món này"
                                    >
                                      <span>
                                        {subItem.note || `Khoản #${idx + 1}`}:{' '}
                                        <strong>{formatVND(subItem.amount)}</strong>
                                      </span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => removeParticipantItem(subItem.id)}
                                      className="text-slate-400 hover:text-rose-600 p-0.5 rounded"
                                      title="Xoá khoản này"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Nút mở QR Tổng, Copy Link riêng & Xoá */}
                          <div className="flex items-center justify-end gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                openQrModal({
                                  mode: 'person',
                                  personKey: person.personKey,
                                })
                              }
                              className="inline-flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 active:scale-95 text-indigo-700 font-semibold text-xs px-3.5 py-2 rounded-xl border border-indigo-200/80 transition"
                            >
                              <QrCode className="w-4 h-4" />
                              <span>
                                {person.items.length > 1 ? 'Hiện QR Tổng' : 'Hiện mã QR'}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleCopyShareLink(person.displayName)}
                              className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition"
                              title={`Sao chép Link thanh toán riêng gửi cho ${person.displayName}`}
                            >
                              <Share2 className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => removePersonGroup(person.personKey)}
                              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                              title={`Xoá tất cả khoản của ${person.displayName}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )
              ) : (
                /* DANH SÁCH CHẾ ĐỘ 2: TỪNG KHOẢN LẺ (INDIVIDUAL ITEMS VIEW) */
                filteredItems.length === 0 ? (
                  <div className="p-10 text-center space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                      <Receipt className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700">
                      Chưa có khoản thu nào trong danh sách
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {filteredItems.map((participant) => (
                      <li
                        key={participant.id}
                        className={`px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                          participant.paid ? 'bg-emerald-50/30' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <button
                            type="button"
                            onClick={() => toggleItemPaidStatus(participant.id)}
                            className={`w-6 h-6 rounded-lg flex items-center justify-center border transition shrink-0 ${
                              participant.paid
                                ? 'bg-emerald-500 border-emerald-500 text-white shadow-2xs'
                                : 'border-slate-300 bg-white hover:border-indigo-500'
                            }`}
                            aria-label={`Đổi trạng thái thanh toán của ${participant.name}`}
                          >
                            {participant.paid && <Check className="w-4 h-4 stroke-[3]" />}
                          </button>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p
                                className={`font-bold text-sm sm:text-base truncate ${
                                  participant.paid ? 'line-through text-slate-400' : 'text-slate-800'
                                }`}
                              >
                                {participant.name}
                                {participant.note ? (
                                  <span className="font-normal text-xs text-slate-500 ml-1.5">
                                    ({participant.note})
                                  </span>
                                ) : null}
                              </p>
                              <button
                                type="button"
                                onClick={() => toggleItemPaidStatus(participant.id)}
                                className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border transition ${
                                  participant.paid
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                    : 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200/70'
                                }`}
                              >
                                {participant.paid ? 'Đã trả' : 'Chưa trả'}
                              </button>
                            </div>
                            <p
                              className={`text-sm font-extrabold mt-0.5 ${
                                participant.paid ? 'text-emerald-600/70' : 'text-indigo-600'
                              }`}
                            >
                              {formatVND(participant.amount)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              openQrModal({
                                mode: 'item',
                                id: participant.id,
                              })
                            }
                            className="inline-flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 active:scale-95 text-indigo-700 font-semibold text-xs px-3.5 py-2 rounded-xl border border-indigo-200/80 transition"
                          >
                            <QrCode className="w-4 h-4" />
                            <span>Hiện mã QR</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => removeParticipantItem(participant.id)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                            title="Xoá mục này"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )
              )}
            </section>
          </main>
        </>
      )}

      {/* ============================================================ */}
      {/* PHASE 3: DYNAMIC VIETQR MODAL (<dialog closedby="any">)      */}
      {/* ============================================================ */}
      <dialog
        ref={qrDialogRef}
        closedby="any"
        aria-labelledby="qr-modal-title"
        className="backdrop:bg-slate-900/60 backdrop:backdrop-blur-xs rounded-3xl p-0 w-full max-w-md mx-auto my-auto shadow-2xl border border-slate-200 open:animate-in open:fade-in open:zoom-in-95"
      >
        {liveQrData && (
          <div className="bg-white text-slate-900 overflow-hidden">
            {/* Modal Header */}
            <div
              className={`px-5 py-4 text-white flex items-center justify-between ${
                appRole === 'payer'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600'
                  : 'bg-gradient-to-r from-indigo-600 to-violet-600'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <QrCode className="w-5 h-5" />
                <div>
                  <h3 id="qr-modal-title" className="font-bold text-base">
                    {liveQrData.items?.length > 1
                      ? `Mã VietQR Tổng Hợp (${liveQrData.items.length} khoản)`
                      : 'Mã VietQR Thanh Toán'}
                  </h3>
                  <p className="text-xs text-white/90">
                    Người chuyển: <strong>{liveQrData.name}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeQrModal}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
                aria-label="Đóng cửa sổ QR"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {!hostSettings.bankBin || !hostSettings.accountNumber ? (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center space-y-3">
                  <AlertCircle className="w-8 h-8 text-amber-600 mx-auto" />
                  <div>
                    <p className="text-sm font-bold text-amber-900">
                      Chưa có Số tài khoản nhận tiền!
                    </p>
                    <p className="text-xs text-amber-700 mt-1">
                      {appRole === 'host'
                        ? 'Vui lòng nhập Ngân hàng (BIN) và Số tài khoản trong phần "Cài đặt nhận tiền" để tạo mã VietQR.'
                        : 'Chủ trì hiện chưa cấu hình số tài khoản ngân hàng.'}
                    </p>
                  </div>
                  {appRole === 'host' && (
                    <button
                      type="button"
                      onClick={() => {
                        closeQrModal();
                        setIsSettingsOpen(true);
                      }}
                      className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-4 py-2 rounded-xl"
                    >
                      Mở Cài đặt ngay
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {/* QR Image Container */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col items-center">
                    <img
                      src={activeQrUrl}
                      alt={`VietQR cho ${liveQrData.name}`}
                      className="w-64 sm:w-72 h-auto rounded-xl shadow-xs bg-white p-2 border border-slate-100"
                    />
                    <div className="mt-3 text-center w-full">
                      <span className="text-xs text-slate-500">
                        {liveQrData.items?.length > 1
                          ? 'Tổng số tiền cần thanh toán'
                          : 'Số tiền chính xác'}
                      </span>
                      <p className="text-xl font-extrabold text-indigo-600">
                        {formatVND(liveQrData.amount)}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">
                        Nội dung CK:{' '}
                        <code className="bg-slate-200/80 px-1.5 py-0.5 rounded font-semibold text-slate-800">
                          {removeVietnameseTones(liveQrData.name).slice(0, 28) || 'Ban'} thanh toan
                        </code>
                      </p>

                      {/* Chi tiết các món cấu thành trong QR Tổng */}
                      {liveQrData.items?.length > 1 && (
                        <div className="mt-3 pt-2.5 border-t border-slate-200/80 text-left">
                          <p className="text-[11px] font-semibold text-slate-500 mb-1">
                            Chi tiết các khoản của {liveQrData.name}:
                          </p>
                          <ul className="space-y-1">
                            {liveQrData.items.map((it, idx) => (
                              <li
                                key={it.id}
                                className="flex items-center justify-between text-xs text-slate-700"
                              >
                                <span className={it.paid ? 'line-through text-slate-400' : ''}>
                                  • {it.note || `Khoản #${idx + 1}`}
                                </span>
                                <span
                                  className={`font-semibold ${
                                    it.paid ? 'line-through text-slate-400' : 'text-slate-900'
                                  }`}
                                >
                                  {formatVND(it.amount)} {it.paid ? '(Đã trả)' : ''}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons inside Modal */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={handleCopyQrLink}
                      className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition"
                    >
                      {qrCopied ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-600" />
                          <span className="text-emerald-700">Đã chép link QR</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Chép link ảnh QR</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadQrImage}
                      disabled={isDownloadingQr}
                      className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition disabled:opacity-60"
                    >
                      {isDownloadingQr ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      <span>Tải ảnh QR</span>
                    </button>
                  </div>

                  {/* Nút xác nhận dành cho Chủ trì HOẶC Người trả tiền báo đã chuyển khoản */}
                  <button
                    type="button"
                    onClick={() => {
                      if (liveQrData.mode === 'person') {
                        togglePersonPaidStatus(liveQrData.personKey, !liveQrData.paid);
                      } else {
                        toggleItemPaidStatus(liveQrData.id);
                      }
                      if (appRole === 'payer' && !liveQrData.paid) {
                        showToast(`Đã ghi nhận ${liveQrData.name} hoàn tất chuyển khoản!`);
                      }
                    }}
                    className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm transition ${
                      liveQrData.paid
                        ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {liveQrData.paid
                        ? appRole === 'host'
                          ? 'Đang đánh dấu: Đã trả đủ (Nhấn để hoàn tác)'
                          : '✓ Bạn đã xác nhận chuyển khoản'
                        : appRole === 'host'
                        ? `Xác nhận ${liveQrData.name} Đã trả đủ`
                        : 'Tôi đã chuyển khoản xong'}
                    </span>
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
