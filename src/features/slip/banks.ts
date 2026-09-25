/**
 * Thai bank codes (Bank of Thailand) — the slip QR and slip-ocr both report banks by code.
 * TMN (TrueMoney Wallet) is ours, not a BOT code: TrueMoney slips name the wallet like a bank.
 * Keep the codes in sync with BANK_CODES in supabase/functions/_shared/slip-contract.ts.
 */
export type Bank = { code: string; short: string; nameTh: string; nameEn: string };

export const BANKS: Bank[] = [
  { code: '004', short: 'KBank', nameTh: 'กสิกรไทย', nameEn: 'Kasikornbank' },
  { code: '014', short: 'SCB', nameTh: 'ไทยพาณิชย์', nameEn: 'Siam Commercial Bank' },
  { code: '002', short: 'BBL', nameTh: 'กรุงเทพ', nameEn: 'Bangkok Bank' },
  { code: '006', short: 'KTB', nameTh: 'กรุงไทย', nameEn: 'Krungthai Bank' },
  { code: '025', short: 'Krungsri', nameTh: 'กรุงศรีอยุธยา', nameEn: 'Bank of Ayudhya' },
  { code: '011', short: 'ttb', nameTh: 'ทหารไทยธนชาต', nameEn: 'TMBThanachart' },
  { code: '030', short: 'GSB', nameTh: 'ออมสิน', nameEn: 'Government Savings Bank' },
  { code: '069', short: 'KKP', nameTh: 'เกียรตินาคินภัทร', nameEn: 'Kiatnakin Phatra' },
  { code: '022', short: 'CIMB', nameTh: 'ซีไอเอ็มบี ไทย', nameEn: 'CIMB Thai' },
  { code: '024', short: 'UOB', nameTh: 'ยูโอบี', nameEn: 'UOB' },
  { code: '067', short: 'TISCO', nameTh: 'ทิสโก้', nameEn: 'TISCO' },
  { code: '073', short: 'LH Bank', nameTh: 'แลนด์ แอนด์ เฮ้าส์', nameEn: 'LH Bank' },
  { code: '033', short: 'GHB', nameTh: 'อาคารสงเคราะห์', nameEn: 'Government Housing Bank' },
  { code: '034', short: 'BAAC', nameTh: 'ธ.ก.ส.', nameEn: 'BAAC' },
  { code: '066', short: 'Islamic', nameTh: 'อิสลามแห่งประเทศไทย', nameEn: 'Islamic Bank of Thailand' },
  { code: '098', short: 'SME D', nameTh: 'SME D Bank', nameEn: 'SME D Bank' },
  { code: 'TMN', short: 'TrueMoney', nameTh: 'ทรูมันนี่ วอลเล็ท', nameEn: 'TrueMoney Wallet' }, // e-wallet, not a BOT code
];

export const bankByCode = (code: string | null | undefined): Bank | undefined => BANKS.find((b) => b.code === code);
