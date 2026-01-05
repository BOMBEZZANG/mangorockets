'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

type UserRole = 'student' | 'instructor' | 'admin'

export default function DevRoleSwitcher() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [currentRole, setCurrentRole] = useState<UserRole>('student')
  const [isLoading, setIsLoading] = useState(true)
  const [isChanging, setIsChanging] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // getSession()은 로컬 스토리지를 먼저 확인하므로 더 빠름
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        console.log('[DevRoleSwitcher] Session check:', {
          hasSession: !!session,
          userId: session?.user?.id,
          sessionError
        })

        if (!session?.user) {
          setIsLoggedIn(false)
          setIsLoading(false)
          return
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single()

        console.log('[DevRoleSwitcher] Profile check:', { profile, profileError })

        if (profile?.role) {
          setCurrentRole(profile.role as UserRole)
        }

        setIsLoggedIn(true)
      } catch (error) {
        console.error('[DevRoleSwitcher] Auth error:', error)
        setIsLoggedIn(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkAuth()
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleRoleChange = async (newRole: UserRole) => {
    if (newRole === currentRole) return

    setIsChanging(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        alert('로그인이 필요합니다.')
        return
      }

      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', user.id)

      if (error) {
        throw error
      }

      setCurrentRole(newRole)
      // 페이지 새로고침으로 Navbar 등 업데이트
      window.location.reload()
    } catch (error) {
      console.error('Role 변경 오류:', error)
      alert('Role 변경에 실패했습니다.')
    } finally {
      setIsChanging(false)
    }
  }

  const roles: { value: UserRole; label: string; emoji: string }[] = [
    { value: 'student', label: '학생', emoji: '🎓' },
    { value: 'instructor', label: '강사', emoji: '👩‍🏫' },
    { value: 'admin', label: '관리자', emoji: '👑' },
  ]

  if (isLoading) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 min-w-[200px]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-400">🔧 DEV MODE</span>
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-orange-500 border-t-transparent"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 min-w-[200px]">
        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-100">
          <span className="text-xs font-medium text-gray-400">🔧 DEV MODE</span>
          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">테스트용</span>
        </div>

        {!isLoggedIn ? (
          <p className="text-xs text-gray-500">로그인 후 Role을 변경할 수 있습니다.</p>
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-2">현재 Role 변경:</p>

            <div className="flex flex-col gap-2">
              {roles.map((role) => (
                <button
                  key={role.value}
                  onClick={() => handleRoleChange(role.value)}
                  disabled={isChanging}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                    currentRole === role.value
                      ? 'bg-gradient-to-r from-orange-500 to-yellow-500 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  } disabled:opacity-50`}
                >
                  <span>{role.emoji}</span>
                  <span>{role.label}</span>
                  {currentRole === role.value && (
                    <span className="ml-auto text-xs">✓</span>
                  )}
                </button>
              ))}
            </div>

            {isChanging && (
              <div className="mt-3 flex items-center justify-center gap-2 text-xs text-gray-500">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-orange-500 border-t-transparent"></div>
                변경 중...
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
