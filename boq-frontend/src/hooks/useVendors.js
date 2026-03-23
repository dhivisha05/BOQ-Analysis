import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getMyVendors,
  addVendorManually,
  updateVendorRecord,
  deleteVendor as removeVendor,
} from '../services/vendorService';

export function useVendors() {
  const { user } = useAuth();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) {
      setVendors([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await getMyVendors(user.id);
      setVendors(data || []);
    } catch (error) {
      console.error('[Vendors] Fetch error:', error.message);
      setVendors([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const addVendor = async (vendor) => {
    const data = await addVendorManually(user.id, vendor);
    setVendors(prev => [data, ...prev]);
    return data;
  };

  const updateVendor = async (id, updates) => {
    const data = await updateVendorRecord(user.id, id, updates);
    setVendors(prev => prev.map(v => v.id === id ? data : v));
    return data;
  };

  const deleteVendor = async (id) => {
    await removeVendor(id);
    setVendors(prev => prev.filter(v => v.id !== id));
  };

  return { vendors, loading, addVendor, updateVendor, deleteVendor, refetch: fetch };
}
