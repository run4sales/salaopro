import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { captureReferral } from '@/lib/ambassadorReferral';
export default function AmbassadorReferralCapture() {
  const { search } = useLocation();
  useEffect(() => { captureReferral(search); }, [search]);
  return null;
}