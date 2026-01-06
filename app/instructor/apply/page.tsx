'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const TOPIC_OPTIONS = [
  '디지털 마케팅',
  '콘텐츠 마케팅',
  'SNS 마케팅',
  '퍼포먼스 마케팅',
  '브랜드 마케팅 / 브랜딩',
  '이메일 마케팅',
  'SEO / 검색 마케팅',
  '마케팅 자동화',
  '마케팅 창업 / 에이전시 운영',
]

const REFERRAL_OPTIONS = [
  '인터넷 검색',
  'SNS (인스타그램, 유튜브 등)',
  '지인 추천',
  '온라인 광고',
  '기타',
]

export default function InstructorApplyPage() {
  const router = useRouter()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [userEmail, setUserEmail] = useState('')

  // 폼 상태
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    introduction: '',
    portfolioLink: '',
    topics: [] as string[],
    customTopic: '',
    referral: '',
  })

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setIsLoggedIn(false)
        setIsLoading(false)
        return
      }

      // 이미 강사인 경우 대시보드로 리다이렉트
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role === 'instructor' || profile?.role === 'admin') {
        router.push('/instructor/dashboard')
        return
      }

      setUserEmail(user.email || '')
      setIsLoggedIn(true)
      setIsLoading(false)
    }

    checkAuth()
  }, [router])

  const handleTopicChange = (topic: string) => {
    setFormData(prev => ({
      ...prev,
      topics: prev.topics.includes(topic)
        ? prev.topics.filter(t => t !== topic)
        : [...prev.topics, topic]
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 유효성 검사
    if (!formData.name.trim()) {
      alert('성명 또는 사업자명을 입력해주세요.')
      return
    }
    if (!formData.phone.trim()) {
      alert('연락처를 입력해주세요.')
      return
    }
    if (!formData.introduction.trim()) {
      alert('강사 소개를 입력해주세요.')
      return
    }
    if (formData.topics.length === 0) {
      alert('강의 주제를 하나 이상 선택해주세요.')
      return
    }
    if (!formData.referral) {
      alert('플랫폼을 알게 된 경로를 선택해주세요.')
      return
    }

    setIsSubmitting(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        alert('로그인이 필요합니다.')
        router.push('/login')
        return
      }

      // role을 instructor로 업데이트하고 강사 정보 저장
      const { error } = await supabase
        .from('profiles')
        .update({
          role: 'instructor',
          instructor_name: formData.name,
          instructor_phone: formData.phone,
          instructor_introduction: formData.introduction,
          instructor_portfolio: formData.portfolioLink,
          instructor_topics: formData.topics.concat(formData.customTopic ? [formData.customTopic] : []),
          instructor_referral: formData.referral,
        })
        .eq('id', user.id)

      if (error) {
        throw error
      }

      alert('강사 등록이 완료되었습니다!')
      router.push('/instructor/dashboard')
    } catch (error) {
      console.error('강사 등록 오류:', error)
      alert('강사 등록 중 오류가 발생했습니다. 프로필 테이블에 필요한 컬럼이 있는지 확인해주세요.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white pt-24 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
      </div>
    )
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white pt-24">
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <div className="bg-white rounded-3xl shadow-xl p-12">
            <div className="text-6xl mb-6">🔐</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              로그인이 필요합니다
            </h1>
            <p className="text-gray-600 mb-8">
              강사로 등록하려면 먼저 로그인해주세요.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-yellow-500 px-8 py-3 text-white font-medium hover:shadow-lg transition-shadow"
            >
              로그인하기
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white pt-24 pb-16">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
          {/* 헤더 */}
          <div className="bg-gradient-to-r from-orange-500 to-yellow-500 px-8 py-10 text-center text-white">
            <div className="text-4xl mb-3">🚀</div>
            <h1 className="text-2xl font-bold mb-1">Share Your Knowledge</h1>
            <p className="text-orange-100">마케팅 온라인 강사 등록</p>
          </div>

          {/* 폼 */}
          <form onSubmit={handleSubmit} className="px-8 py-8 space-y-6">
            <p className="text-sm text-gray-500 mb-6">아래 정보를 입력해 주세요. * 표시는 필수 항목입니다.</p>

            {/* 이메일 (자동 입력) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                이메일 *
              </label>
              <input
                type="email"
                value={userEmail}
                disabled
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-500"
              />
              <p className="text-xs text-gray-400 mt-1">로그인된 이메일이 자동으로 입력됩니다.</p>
            </div>

            {/* 성명 또는 사업자명 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                성명 또는 사업자명 *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="예: 김마케터 또는 ○○마케팅에이전시"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:border-orange-300 focus:ring focus:ring-orange-200 focus:ring-opacity-50 transition-colors"
              />
            </div>

            {/* 연락처 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                연락처 *
              </label>
              <div className="flex gap-2">
                <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-600">
                  🇰🇷 +82
                </div>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="010-1234-5678"
                  className="flex-1 rounded-xl border border-gray-200 px-4 py-3 focus:border-orange-300 focus:ring focus:ring-orange-200 focus:ring-opacity-50 transition-colors"
                />
              </div>
            </div>

            {/* 강사 소개 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                강사 소개 *
              </label>
              <textarea
                value={formData.introduction}
                onChange={(e) => setFormData(prev => ({ ...prev, introduction: e.target.value }))}
                placeholder={`경력, 전문 분야, 강의 주제를 자유롭게 작성해 주세요.

예시:
안녕하세요. 저는 디지털 마케팅 분야에서 5년 이상의 실무 경험을 가진 마케팅 전문가입니다.
SNS 마케팅, 퍼포먼스 마케팅, 콘텐츠 전략 등 다양한 분야에서 활동해 왔으며,
초보자도 이해하기 쉬운 실전 중심의 마케팅 강의를 제공합니다.`}
                rows={6}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:border-orange-300 focus:ring focus:ring-orange-200 focus:ring-opacity-50 transition-colors resize-none"
              />
            </div>

            {/* 포트폴리오 링크 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                포트폴리오 링크 (선택)
              </label>
              <input
                type="url"
                value={formData.portfolioLink}
                onChange={(e) => setFormData(prev => ({ ...prev, portfolioLink: e.target.value }))}
                placeholder="예: https://instagram.com/beauty_expert"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:border-orange-300 focus:ring focus:ring-orange-200 focus:ring-opacity-50 transition-colors"
              />
              <p className="text-xs text-gray-400 mt-1">개인 홈페이지, 인스타그램, 유튜브, 블로그 등</p>
            </div>

            {/* 강의 주제 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                강의 주제 또는 관심 분야 * <span className="text-gray-400 font-normal">(복수 선택 가능)</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {TOPIC_OPTIONS.map((topic) => (
                  <label
                    key={topic}
                    className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-colors ${
                      formData.topics.includes(topic)
                        ? 'border-orange-400 bg-orange-50 text-orange-700'
                        : 'border-gray-200 hover:border-orange-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={formData.topics.includes(topic)}
                      onChange={() => handleTopicChange(topic)}
                      className="sr-only"
                    />
                    <span className={`w-4 h-4 rounded border flex items-center justify-center ${
                      formData.topics.includes(topic)
                        ? 'bg-orange-500 border-orange-500 text-white'
                        : 'border-gray-300'
                    }`}>
                      {formData.topics.includes(topic) && (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </span>
                    <span className="text-sm">{topic}</span>
                  </label>
                ))}
              </div>
              <input
                type="text"
                value={formData.customTopic}
                onChange={(e) => setFormData(prev => ({ ...prev, customTopic: e.target.value }))}
                placeholder="기타 (직접 입력)"
                className="w-full mt-2 rounded-xl border border-gray-200 px-4 py-3 focus:border-orange-300 focus:ring focus:ring-orange-200 focus:ring-opacity-50 transition-colors"
              />
            </div>

            {/* 플랫폼 알게된 경로 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                해당 플랫폼을 어떻게 알게 되셨나요? *
              </label>
              <div className="space-y-2">
                {REFERRAL_OPTIONS.map((option) => (
                  <label
                    key={option}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      formData.referral === option
                        ? 'border-orange-400 bg-orange-50 text-orange-700'
                        : 'border-gray-200 hover:border-orange-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="referral"
                      value={option}
                      checked={formData.referral === option}
                      onChange={(e) => setFormData(prev => ({ ...prev, referral: e.target.value }))}
                      className="sr-only"
                    />
                    <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      formData.referral === option
                        ? 'border-orange-500'
                        : 'border-gray-300'
                    }`}>
                      {formData.referral === option && (
                        <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                      )}
                    </span>
                    <span className="text-sm">{option}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 참고 팁 */}
            <div className="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-xl p-5">
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <span>✨</span> 참고 팁
              </h3>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>• 실무 경험 강조 (년차, 실제 고객/샵 경험)</li>
                <li>• 초보자 대상인지, 전문가 대상인지 명확히</li>
                <li>• 포트폴리오는 SNS 하나만 있어도 충분</li>
                <li>• &quot;수익화 / 취업 / 실전 활용&quot; 키워드 포함 추천</li>
              </ul>
            </div>

            {/* 제출 버튼 */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-full bg-gradient-to-r from-orange-500 to-yellow-500 py-4 text-lg font-bold text-white hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  등록 중...
                </span>
              ) : (
                '강사로 등록하기'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
