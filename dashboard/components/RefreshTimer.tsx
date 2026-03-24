'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RefreshTimer() {
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 10000); // Refresh every 10 seconds

    return () => clearInterval(interval);
  }, [router]);

  return null;
}
