import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";
import AuthPage from "@/components/AuthPage";
import AdminDashboard from "@/components/AdminDashboard";
import DesignerDashboard from "@/components/DesignerDashboard";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Fetch user profile to get role
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();
            
          if (error) {
            console.error('Error fetching profile:', error);
            toast({
              title: "خطأ",
              description: "حدث خطأ في تحميل بيانات المستخدم",
              variant: "destructive",
            });
          } else {
            setUserRole(profile?.role || null);
          }
        } else {
          setUserRole(null);
        }
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [toast]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!session || !user) {
    return <AuthPage />;
  }

  if (!userRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">مرحباً بك!</h2>
          <p className="text-muted-foreground">جاري إعداد حسابك...</p>
        </div>
      </div>
    );
  }

  if (userRole === 'admin') {
    return <AdminDashboard user={user} />;
  } else if (userRole === 'designer') {
    return <DesignerDashboard user={user} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">دور غير محدد</h2>
        <p className="text-muted-foreground">يرجى التواصل مع المدير لتحديد صلاحياتك</p>
      </div>
    </div>
  );
};

export default Index;