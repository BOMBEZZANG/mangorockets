// 라이브 세션 상태
export type LiveSessionStatus = 'scheduled' | 'live' | 'ended' | 'cancelled'

// 접근 권한 타입
export type LiveAccessType = 'public' | 'paid'

// 라이브 세션 인터페이스
export interface LiveSession {
  id: string
  instructor_id: string
  course_id: string | null  // null이면 독립 라이브
  title: string
  description: string | null
  thumbnail: string | null
  scheduled_at: string | null  // null이면 즉시 시작
  started_at: string | null
  ended_at: string | null
  status: LiveSessionStatus
  access_type: LiveAccessType
  room_name: string
  max_participants: number
  created_at: string
  updated_at: string
}

// 라이브 세션 생성 폼 데이터
export interface CreateLiveSessionData {
  title: string
  description?: string
  thumbnail?: string
  course_id?: string
  scheduled_at?: string  // 없으면 즉시 시작
  access_type: LiveAccessType
}

// 라이브 세션 목록 아이템 (조인 데이터 포함)
export interface LiveSessionWithDetails extends LiveSession {
  instructor?: {
    id: string
    full_name: string | null
    avatar_url: string | null
  }
  course?: {
    id: string
    title: string
    price: number
  }
}

// Jitsi 참여 정보
export interface JitsiJoinInfo {
  roomName: string
  displayName: string
  email?: string
  isHost: boolean
}

// 권한 검증 결과
export interface AccessCheckResult {
  allowed: boolean
  reason?: 'not_logged_in' | 'not_purchased' | 'session_not_found' | 'session_not_live'
  joinInfo?: JitsiJoinInfo
  session?: LiveSession
}
