// E-book 관련 타입 정의

export interface Ebook {
  id: string
  title: string
  description: string | null
  category: string
  level: '입문' | '중급' | '고급' | null
  price: number
  thumbnail: string | null
  instructor: string
  full_pdf_path: string | null
  preview_pdf_path: string | null
  page_count: number | null
  file_size_bytes: number | null
  published: boolean
  created_at: string
  updated_at: string
}

export interface EbookWithInstructor extends Ebook {
  profiles?: {
    id: string
    name: string | null
    avatar_url: string | null
  }
}

export interface EbookWithTags extends Ebook {
  tags?: Tag[]
  rating?: {
    average: number
    count: number
  }
}

export interface Tag {
  id: string
  category: string
  name: string
}

export interface EbookPurchase {
  id: string
  user_id: string
  ebook_id: string
  payment_id: string
  amount: number
  status: string
  download_count: number
  last_downloaded_at: string | null
  created_at: string
  updated_at: string
}

export interface EbookPurchaseWithEbook extends EbookPurchase {
  ebook: Ebook
}

export interface EbookCartItem {
  id: string
  user_id: string
  ebook_id: string
  created_at: string
  ebook?: Ebook
}

export interface EbookReview {
  id: string
  user_id: string
  ebook_id: string
  rating: number
  comment: string
  created_at: string
  updated_at: string
  user?: {
    id: string
    full_name: string | null
    avatar_url: string | null
  }
  likes_count?: number
  user_has_liked?: boolean
  reply?: EbookReviewReply
}

export interface EbookReviewReply {
  id: string
  review_id: string
  instructor_id: string
  comment: string
  created_at: string
  updated_at: string
}

export interface EbookFormData {
  title: string
  description: string
  category: string
  level: string
  price: number
  thumbnail: string
  fullPdfPath: string
  previewPdfPath: string
  pageCount: number
  fileSizeBytes: number
  selectedTags: string[]
}

// PDF 업로드 응답
export interface PdfUploadResult {
  fullPdfPath: string
  previewPdfPath: string
  previewPdfUrl: string
  pageCount: number
  fileSizeBytes: number
}

// 다운로드 응답
export interface DownloadUrlResult {
  downloadUrl: string
  expiresAt: string
  filename: string
}
