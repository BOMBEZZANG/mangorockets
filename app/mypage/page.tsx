'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Navbar from '@/components/Navbar'
import Link from 'next/link'
import Image from 'next/image'

interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: 'student' | 'instructor' | 'admin'
}

interface PurchasedCourse {
  id: string
  course_id: string
  created_at: string
  course: {
    id: string
    title: string
    thumbnail: string | null
    instructor: string
  }
}

interface InstructorStats {
  totalCourses: number
  totalStudents: number
  publishedCourses: number
}

export default function MyPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [purchasedCourses, setPurchasedCourses] = useState<PurchasedCourse[]>([])
  const [instructorStats, setInstructorStats] = useState<InstructorStats | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [authProvider, setAuthProvider] = useState<string | null>(null)

  // 비밀번호 변경 관련
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login?redirect=/mypage')
        return
      }

      // 인증 방식 확인
      setAuthProvider(user.app_metadata?.provider || 'email')

      // 프로필 정보 가져오기
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileData) {
        setProfile({
          id: profileData.id,
          email: profileData.email || user.email || '',
          full_name: profileData.full_name,
          avatar_url: profileData.avatar_url,
          role: profileData.role || 'student',
        })
        setEditName(profileData.full_name || '')
      }

      // 구매한 강의 목록
      const { data: purchases } = await supabase
        .from('purchases')
        .select(`
          id,
          course_id,
          created_at,
          course:courses (
            id,
            title,
            thumbnail,
            instructor
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (purchases) {
        setPurchasedCourses(purchases as unknown as PurchasedCourse[])
      }

      // 강사인 경우 통계 가져오기
      if (profileData?.role === 'instructor') {
        // 등록한 강의 수
        const { data: courses, count: courseCount } = await supabase
          .from('courses')
          .select('id, is_published', { count: 'exact' })
          .eq('instructor_id', user.id)

        const publishedCount = courses?.filter(c => c.is_published).length || 0

        // 총 수강생 수
        const courseIds = courses?.map(c => c.id) || []
        let studentCount = 0

        if (courseIds.length > 0) {
          const { count } = await supabase
            .from('purchases')
            .select('id', { count: 'exact' })
            .in('course_id', courseIds)

          studentCount = count || 0
        }

        setInstructorStats({
          totalCourses: courseCount || 0,
          publishedCourses: publishedCount,
          totalStudents: studentCount,
        })
      }

      setLoading(false)
    }

    loadData()
  }, [router])

  // 프로필 이름 저장
  const handleSaveName = async () => {
    if (!profile) return

    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: editName })
      .eq('id', profile.id)

    if (!error) {
      setProfile({ ...profile, full_name: editName })
      setIsEditing(false)
    }
    setSaving(false)
  }

  // 아바타 업로드
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile) return

    // 파일 크기 체크 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('이미지 크기는 5MB 이하여야 합니다.')
      return
    }

    setUploadingAvatar(true)

    try {
      // 파일명 생성
      const fileExt = file.name.split('.').pop()
      const fileName = `${profile.id}-${Date.now()}.${fileExt}`
      const filePath = `avatars/${fileName}`

      // Supabase Storage에 업로드
      const { error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // Public URL 가져오기
      const { data: { publicUrl } } = supabase.storage
        .from('profiles')
        .getPublicUrl(filePath)

      // 프로필 업데이트
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', profile.id)

      if (updateError) throw updateError

      setProfile({ ...profile, avatar_url: publicUrl })
    } catch (error) {
      console.error('아바타 업로드 오류:', error)
      alert('이미지 업로드에 실패했습니다.')
    } finally {
      setUploadingAvatar(false)
    }
  }

  // 비밀번호 변경
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(false)

    if (newPassword !== confirmPassword) {
      setPasswordError('새 비밀번호가 일치하지 않습니다.')
      return
    }

    if (newPassword.length < 6) {
      setPasswordError('비밀번호는 6자 이상이어야 합니다.')
      return
    }

    setChangingPassword(true)

    const { error } = await supabase.auth.updateUser({
      password: newPassword
    })

    if (error) {
      setPasswordError(error.message)
    } else {
      setPasswordSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => {
        setShowPasswordForm(false)
        setPasswordSuccess(false)
      }, 2000)
    }

    setChangingPassword(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="pt-24 flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
        </div>
      </div>
    )
  }

  if (!profile) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="pt-24 pb-12">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-8">마이페이지</h1>

          {/* 프로필 정보 섹션 */}
          <section className="bg-white rounded-2xl shadow-sm border p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">프로필 정보</h2>

            <div className="flex flex-col sm:flex-row gap-6">
              {/* 아바타 */}
              <div className="flex flex-col items-center">
                <div className="relative">
                  {profile.avatar_url ? (
                    <Image
                      src={profile.avatar_url}
                      alt="프로필"
                      width={100}
                      height={100}
                      className="rounded-full object-cover w-24 h-24"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-orange-400 to-yellow-400 flex items-center justify-center text-white text-3xl font-bold">
                      {profile.full_name?.charAt(0) || profile.email?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                  )}
                  {uploadingAvatar && (
                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
                    </div>
                  )}
                </div>
                <label className="mt-3 text-sm text-orange-500 hover:text-orange-600 cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                    disabled={uploadingAvatar}
                  />
                  이미지 변경
                </label>
              </div>

              {/* 정보 */}
              <div className="flex-1 space-y-4">
                {/* 이름 */}
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">이름</label>
                  {isEditing ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                        placeholder="이름을 입력하세요"
                      />
                      <button
                        onClick={handleSaveName}
                        disabled={saving}
                        className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
                      >
                        {saving ? '저장 중...' : '저장'}
                      </button>
                      <button
                        onClick={() => {
                          setIsEditing(false)
                          setEditName(profile.full_name || '')
                        }}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800"
                      >
                        취소
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-900">{profile.full_name || '이름 없음'}</span>
                      <button
                        onClick={() => setIsEditing(true)}
                        className="text-sm text-orange-500 hover:text-orange-600"
                      >
                        수정
                      </button>
                    </div>
                  )}
                </div>

                {/* 이메일 */}
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">이메일</label>
                  <span className="text-gray-900">{profile.email}</span>
                </div>

                {/* 계정 유형 */}
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">계정 연동</label>
                  <div className="flex items-center gap-2">
                    {authProvider === 'google' ? (
                      <span className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full text-sm">
                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        Google 계정
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full text-sm">
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        이메일 계정
                      </span>
                    )}
                  </div>
                </div>

                {/* 역할 */}
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">회원 유형</label>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    profile.role === 'instructor'
                      ? 'bg-yellow-100 text-purple-700'
                      : profile.role === 'admin'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {profile.role === 'instructor' ? '강사' : profile.role === 'admin' ? '관리자' : '수강생'}
                  </span>
                </div>
              </div>
            </div>

            {/* 비밀번호 변경 (이메일 계정만) */}
            {authProvider === 'email' && (
              <div className="mt-6 pt-6 border-t">
                {!showPasswordForm ? (
                  <button
                    onClick={() => setShowPasswordForm(true)}
                    className="text-sm text-gray-600 hover:text-orange-500"
                  >
                    비밀번호 변경
                  </button>
                ) : (
                  <form onSubmit={handleChangePassword} className="max-w-sm space-y-4">
                    <h3 className="font-medium text-gray-900">비밀번호 변경</h3>

                    {passwordError && (
                      <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">
                        {passwordError}
                      </div>
                    )}

                    {passwordSuccess && (
                      <div className="p-3 bg-green-50 text-green-600 text-sm rounded-lg">
                        비밀번호가 변경되었습니다.
                      </div>
                    )}

                    <div>
                      <label className="block text-sm text-gray-600 mb-1">새 비밀번호</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                        placeholder="6자 이상 입력"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-gray-600 mb-1">새 비밀번호 확인</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                        placeholder="비밀번호 재입력"
                        required
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={changingPassword}
                        className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
                      >
                        {changingPassword ? '변경 중...' : '변경하기'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowPasswordForm(false)
                          setPasswordError(null)
                          setNewPassword('')
                          setConfirmPassword('')
                        }}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800"
                      >
                        취소
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </section>

          {/* 강사 정보 섹션 (강사만) */}
          {profile.role === 'instructor' && instructorStats && (
            <section className="bg-gradient-to-r from-yellow-500 to-orange-500 rounded-2xl shadow-sm p-6 mb-6 text-white">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold">강사 대시보드</h2>
                <Link
                  href="/instructor/dashboard"
                  className="text-sm bg-white/20 hover:bg-white/30 px-4 py-2 rounded-full transition-colors"
                >
                  대시보드 바로가기 →
                </Link>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white/10 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold">{instructorStats.totalCourses}</div>
                  <div className="text-sm text-white/80">등록한 강의</div>
                </div>
                <div className="bg-white/10 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold">{instructorStats.publishedCourses}</div>
                  <div className="text-sm text-white/80">공개 강의</div>
                </div>
                <div className="bg-white/10 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold">{instructorStats.totalStudents}</div>
                  <div className="text-sm text-white/80">총 수강생</div>
                </div>
              </div>
            </section>
          )}

          {/* 구매한 강의 섹션 */}
          <section className="bg-white rounded-2xl shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">내 수강 강의</h2>

            {purchasedCourses.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-5xl mb-4">📚</div>
                <p className="text-gray-500 mb-4">아직 구매한 강의가 없습니다</p>
                <Link
                  href="/courses"
                  className="inline-flex items-center gap-2 text-orange-500 hover:text-orange-600 font-medium"
                >
                  강의 둘러보기 →
                </Link>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {purchasedCourses.map((purchase) => (
                  <Link
                    key={purchase.id}
                    href={`/courses/${purchase.course_id}`}
                    className="flex gap-4 p-4 rounded-xl border hover:border-orange-300 hover:shadow-md transition-all"
                  >
                    <div className="relative w-24 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                      {purchase.course?.thumbnail ? (
                        <Image
                          src={purchase.course.thumbnail}
                          alt={purchase.course.title}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-orange-100 to-yellow-100">
                          <span className="text-2xl">🚀</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">
                        {purchase.course?.title || '강의'}
                      </h3>
                      <p className="text-sm text-gray-500">{purchase.course?.instructor}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(purchase.created_at).toLocaleDateString('ko-KR')} 구매
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* 강사 신청 안내 (수강생만) */}
          {profile.role === 'student' && (
            <section className="mt-6 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-2xl border border-orange-200 p-6">
              <div className="flex items-center gap-4">
                <div className="text-4xl">🎓</div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">강사가 되어보세요!</h3>
                  <p className="text-sm text-gray-600">나만의 마케팅 노하우를 공유하고 수익을 창출하세요</p>
                </div>
                <Link
                  href="/instructor/apply"
                  className="px-4 py-2 bg-gradient-to-r from-orange-500 to-yellow-500 text-white rounded-full text-sm font-medium hover:shadow-lg transition-shadow"
                >
                  강사 신청하기
                </Link>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  )
}
