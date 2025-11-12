'use client'
import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'
function page() {
  const router = useRouter()
  // 跳转到 excel 页面
  useEffect(() => {
    router.push('/excel')
  }, [])
  return (
    <div>page</div>
  )
}

export default page