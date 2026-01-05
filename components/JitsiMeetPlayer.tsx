'use client'

import { useEffect, useRef, useState } from 'react'
import { JitsiMeeting } from '@jitsi/react-sdk'

interface JitsiMeetPlayerProps {
  roomName: string
  displayName: string
  email?: string
  isHost?: boolean
  onApiReady?: (api: unknown) => void
  onReadyToClose?: () => void
  onParticipantJoined?: (participant: unknown) => void
  onParticipantLeft?: (participant: unknown) => void
}

export default function JitsiMeetPlayer({
  roomName,
  displayName,
  email,
  isHost = false,
  onApiReady,
  onReadyToClose,
  onParticipantJoined,
  onParticipantLeft,
}: JitsiMeetPlayerProps) {
  const [isLoading, setIsLoading] = useState(true)
  const apiRef = useRef<unknown>(null)

  // Jitsi 설정
  const configOverwrite = {
    startWithAudioMuted: !isHost,
    startWithVideoMuted: !isHost,
    prejoinPageEnabled: false,
    disableDeepLinking: true,
    // 로컬 녹화 활성화
    localRecording: {
      enabled: true,
      format: 'webm',
    },
    // 툴바 버튼 설정
    toolbarButtons: isHost
      ? [
          'microphone',
          'camera',
          'closedcaptions',
          'desktop',
          'fullscreen',
          'fodeviceselection',
          'hangup',
          'chat',
          'sharedvideo',
          'settings',
          'raisehand',
          'videoquality',
          'filmstrip',
          'participants-pane',
          'tileview',
          'select-background',
          'download',
          'help',
          'mute-everyone',
          'mute-video-everyone',
          'security',
        ]
      : [
          'microphone',
          'camera',
          'fullscreen',
          'hangup',
          'chat',
          'raisehand',
          'tileview',
          'participants-pane',
        ],
    // 추가 설정
    disableRemoteMute: !isHost,
    remoteVideoMenu: {
      disableKick: !isHost,
      disableGrantModerator: !isHost,
    },
  }

  const interfaceConfigOverwrite = {
    SHOW_JITSI_WATERMARK: false,
    SHOW_WATERMARK_FOR_GUESTS: false,
    MOBILE_APP_PROMO: false,
    DISABLE_JOIN_LEAVE_NOTIFICATIONS: false,
    DEFAULT_BACKGROUND: '#1a1a2e',
    TOOLBAR_ALWAYS_VISIBLE: true,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleApiReady = (externalApi: any) => {
    apiRef.current = externalApi
    setIsLoading(false)

    if (onParticipantJoined) {
      externalApi.addListener('participantJoined', onParticipantJoined)
    }
    if (onParticipantLeft) {
      externalApi.addListener('participantLeft', onParticipantLeft)
    }

    onApiReady?.(externalApi)
  }

  useEffect(() => {
    return () => {
      // Cleanup
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const api = apiRef.current as any
      if (api) {
        if (onParticipantJoined) {
          api.removeListener?.('participantJoined', onParticipantJoined)
        }
        if (onParticipantLeft) {
          api.removeListener?.('participantLeft', onParticipantLeft)
        }
      }
    }
  }, [onParticipantJoined, onParticipantLeft])

  return (
    <div className="relative aspect-video bg-gray-900 rounded-xl overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
            <p className="text-gray-400">라이브 연결 중...</p>
          </div>
        </div>
      )}

      <JitsiMeeting
        domain="meet.jit.si"
        roomName={roomName}
        configOverwrite={configOverwrite}
        interfaceConfigOverwrite={interfaceConfigOverwrite}
        userInfo={{
          displayName,
          email: email || '',
        }}
        onApiReady={handleApiReady}
        onReadyToClose={onReadyToClose}
        getIFrameRef={(iframeRef) => {
          iframeRef.style.height = '100%'
          iframeRef.style.width = '100%'
        }}
      />

      {/* 호스트 녹화 안내 */}
      {isHost && !isLoading && (
        <div className="absolute bottom-4 left-4 bg-black/70 text-white text-xs px-3 py-2 rounded-lg">
          <span className="text-orange-400">Tip:</span> OBS 또는 화면 녹화로 라이브를 저장하세요
        </div>
      )}
    </div>
  )
}
