import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import VendorManager from '../components/Vendors/VendorManager';
import { useAuth } from '../context/AuthContext';

export default function VendorsPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const postProjectState = location.state?.postProject || null;

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
    }
  }, [navigate, user]);

  return (
    <Layout>
      <div className="mx-auto max-w-6xl">
        <VendorManager
          userId={user?.id}
          projectId={postProjectState?.projectId}
          projectName={postProjectState?.projectName}
          mode={postProjectState ? 'post_project' : 'standalone'}
          onComplete={() => {
            if (postProjectState?.returnTo) {
              navigate(postProjectState.returnTo, { replace: true });
              return;
            }

            if (postProjectState?.projectId) {
              navigate(`/projects/${postProjectState.projectId}`, { replace: true });
              return;
            }

            navigate('/vendors', { replace: true, state: null });
          }}
        />
      </div>
    </Layout>
  );
}
