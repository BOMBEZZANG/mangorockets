'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

type UserRole = 'student' | 'instructor' | 'admin'

interface UserProfile {
  full_name: string | null
  avatar_url: string | null
  role: UserRole
}

export default function Navbar() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)

  // 클라이언트 마운트 확인 (hydration 오류 방지)
  useEffect(() => {
    setMounted(true)
  }, [])

  // 프로필 메뉴 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const getUserAndProfile = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        console.log('[Navbar] Session check:', {
          hasSession: !!session,
          userId: session?.user?.id,
          email: session?.user?.email,
          sessionError
        })

        const currentUser = session?.user ?? null
        setUser(currentUser)

        if (currentUser) {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('full_name, avatar_url, role')
            .eq('id', currentUser.id)
            .single()

          console.log('[Navbar] Profile check:', { profile, profileError })

          if (profile) {
            setUserProfile({
              full_name: profile.full_name,
              avatar_url: profile.avatar_url,
              role: (profile.role as UserRole) || 'student',
            })
          }
        }
      } catch (error) {
        console.error('[Navbar] Auth error:', error)
      } finally {
        setLoading(false)
      }
    }

    getUserAndProfile()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null)

      if (session?.user) {
        try {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('full_name, avatar_url, role')
            .eq('id', session.user.id)
            .single()

          if (!error && profile) {
            setUserProfile({
              full_name: profile.full_name,
              avatar_url: profile.avatar_url,
              role: (profile.role as UserRole) || 'student',
            })
          }
        } catch (error) {
          console.error('Profile fetch error:', error)
        }
      } else {
        setUserProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setUserProfile(null)
    setIsProfileMenuOpen(false)
    router.push('/')
    router.refresh()
  }

  const userRole = userProfile?.role || 'student'

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🚀</span>
            <span className="text-xl font-bold bg-gradient-to-r from-orange-500 to-yellow-500 bg-clip-text text-transparent">
              MangoRocket
            </span>
          </Link>

          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="text-sm font-medium text-gray-700 hover:text-orange-500 transition-colors"
            >
              상품 목록
            </Link>

            <Link
              href="/live"
              className="flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-orange-500 transition-colors"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              라이브
            </Link>

            {mounted && user && (
              <Link
                href={userRole === 'student' ? '/instructor/apply' : '/instructor/dashboard'}
                className="text-sm font-medium text-gray-700 hover:text-orange-500 transition-colors"
              >
                셀러 센터
              </Link>
            )}

            {!mounted || loading ? (
              <div className="w-10 h-10 bg-gray-100 rounded-full animate-pulse" />
            ) : user ? (
              <div className="relative" ref={profileMenuRef}>
                {/* 프로필 버튼 */}
                <button
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className="flex items-center gap-2 rounded-full p-1 hover:bg-gray-100 transition-colors"
                >
                  {userProfile?.avatar_url ? (
                    <Image
                      src={userProfile.avatar_url}
                      alt="프로필"
                      width={36}
                      height={36}
                      className="rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-yellow-400 flex items-center justify-center text-white font-medium">
                      {userProfile?.full_name?.charAt(0) || user.email?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                  )}
                  <svg
                    className={`w-4 h-4 text-gray-500 transition-transform ${isProfileMenuOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* 프로필 드롭다운 메뉴 */}
                {isProfileMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50">
                    {/* 사용자 정보 */}
                    <div className="p-4 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        {userProfile?.avatar_url ? (
                          <Image
                            src={userProfile.avatar_url}
                            alt="프로필"
                            width={48}
                            height={48}
                            className="rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-yellow-400 flex items-center justify-center text-white text-lg font-medium">
                            {userProfile?.full_name?.charAt(0) || user.email?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {userProfile?.full_name || '사용자'}
                          </p>
                          <p className="text-sm text-gray-500 truncate">
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* 메뉴 항목 */}
                    <div className="py-2">
                      <Link
                        href="/mypage"
                        onClick={() => setIsProfileMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        마이페이지
                      </Link>
                      <Link
                        href="/my-courses"
                        onClick={() => setIsProfileMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                        내 구매목록
                      </Link>
                    </div>

                    {/* 로그아웃 */}
                    <div className="border-t border-gray-100 py-2">
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        로그아웃
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  href="/login"
                  className="text-sm font-medium text-gray-700 hover:text-orange-500 transition-colors"
                >
                  로그인
                </Link>
                <Link
                  href="/signup"
                  className="rounded-full bg-gradient-to-r from-orange-500 to-yellow-500 px-4 py-2 text-sm font-medium text-white hover:shadow-lg transition-shadow"
                >
                  시작하기
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
