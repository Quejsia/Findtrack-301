import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Claim } from '../types';

export function useIncomingClaims(userId: string | undefined) {
  const [incomingClaims, setIncomingClaims] = useState<Claim[]>([]);

  useEffect(() => {
    if (!userId) {
      setIncomingClaims([]);
      return;
    }
    const q = query(collection(db, "claims"), where("finderId", "==", userId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Claim[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Claim);
      });
      list.sort((a, b) => {
        const aTime = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0;
        const bTime = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0;
        return bTime - aTime;
      });
      setIncomingClaims(list);
    }, (err) => console.warn('Claims listener (incoming):', err.code));
    return unsubscribe;
  }, [userId]);

  return incomingClaims;
}

export function useMyClaims(userId: string | undefined) {
  const [myClaims, setMyClaims] = useState<Claim[]>([]);

  useEffect(() => {
    if (!userId) {
      setMyClaims([]);
      return;
    }
    const q = query(collection(db, "claims"), where("claimerId", "==", userId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Claim[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Claim);
      });
      list.sort((a, b) => {
        const aTime = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0;
        const bTime = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0;
        return bTime - aTime;
      });
      setMyClaims(list);
    }, (err) => console.warn('Claims listener (mine):', err.code));
    return unsubscribe;
  }, [userId]);

  return myClaims;
}

export async function markClaimAsRead(claimId: string) {
  try {
    await updateDoc(doc(db, "claims", claimId), {
      isReadByFinder: true,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Failed to mark claim as read", error);
  }
}
