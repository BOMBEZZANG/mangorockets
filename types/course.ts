export interface Course {
  id: string
  title: string
  description: string | null
  thumbnail: string | null
  instructor: string
  instructor_id: string | null
  price: number
  category: string | null
  level: '입문' | '중급' | '고급' | null
  duration: string | null
  video_url: string | null
  created_at: string
}
