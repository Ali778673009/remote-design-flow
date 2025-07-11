import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Download, 
  Share2, 
  Eye, 
  LogOut, 
  Users, 
  Image as ImageIcon, 
  Calendar,
  TrendingUp,
  BarChart3,
  CheckCircle,
  Clock,
  AlertTriangle,
  Palette,
  Target,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import NotificationBell from './NotificationBell';
import TaskManager from './TaskManager';

interface Design {
  id: number;
  name: string;
  description: string;
  image_url: string;
  created_at: string;
  user_id: string;
  profiles?: {
    name: string;
  };
}

interface AdminStats {
  totalDesigns: number;
  activeDesigners: number;
  pendingTasks: number;
  completedTasks: number;
}

interface AdminDashboardProps {
  user: User;
}

const AdminDashboard = ({ user }: AdminDashboardProps) => {
  const [designs, setDesigns] = useState<Design[]>([]);
  const [filteredDesigns, setFilteredDesigns] = useState<Design[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [designerFilter, setDesignerFilter] = useState("all");
  const [designers, setDesigners] = useState<Array<{ id: string; name: string }>>([]);
  const [stats, setStats] = useState<AdminStats>({
    totalDesigns: 0,
    activeDesigners: 0,
    pendingTasks: 0,
    completedTasks: 0
  });
  const { toast } = useToast();

  const fetchStats = async () => {
    try {
      // Get total designs
      const { count: designCount } = await supabase
        .from('designs')
        .select('*', { count: 'exact', head: true });

      // Get active designers
      const { count: designerCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'designer');

      // Get task stats
      const { count: pendingTasksCount } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pending', 'in_progress']);

      const { count: completedTasksCount } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed');

      setStats({
        totalDesigns: designCount || 0,
        activeDesigners: designerCount || 0,
        pendingTasks: pendingTasksCount || 0,
        completedTasks: completedTasksCount || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchDesigns = async () => {
    setLoading(true);
    try {
      // First get all designs
      const { data: designsData, error: designsError } = await supabase
        .from('designs')
        .select('*')
        .order('created_at', { ascending: false });

      if (designsError) {
        toast({
          title: "خطأ",
          description: "حدث خطأ في تحميل التصاميم",
          variant: "destructive",
        });
        return;
      }

      // Then get all profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name');

      if (profilesError) {
        console.warn('Could not fetch profiles:', profilesError);
      }

      // Combine the data
      const designsWithProfiles = (designsData || []).map(design => ({
        ...design,
        profiles: profilesData?.find(profile => profile.id === design.user_id) || null
      }));

      setDesigns(designsWithProfiles);
      setFilteredDesigns(designsWithProfiles);
      
      // Extract unique designers
      const uniqueDesigners = Array.from(
        new Map(
          designsWithProfiles
            .filter(design => design.profiles?.name)
            .map(design => [design.user_id, { id: design.user_id, name: design.profiles!.name }])
        ).values()
      );
      setDesigners(uniqueDesigners);

    } catch (error) {
      toast({
        title: "خطأ",
        description: "حدث خطأ غير متوقع",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDesigns();
    fetchStats();
  }, []);

  useEffect(() => {
    let filtered = designs;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(design =>
        design.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        design.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        design.profiles?.name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by designer
    if (designerFilter !== "all") {
      filtered = filtered.filter(design => design.user_id === designerFilter);
    }

    setFilteredDesigns(filtered);
  }, [designs, searchTerm, designerFilter]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleDownload = async (imageUrl: string, fileName: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName || 'design';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "تم التحميل!",
        description: "تم تحميل الملف بنجاح",
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل في تحميل الملف",
        variant: "destructive",
      });
    }
  };

  const handleShare = async (imageUrl: string, designName: string) => {
    try {
      if (navigator.share && navigator.canShare) {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const file = new File([blob], `${designName}.jpg`, { type: blob.type });
        
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: designName,
            text: `شاهد هذا التصميم الرائع: ${designName}`,
            files: [file]
          });
          return;
        }
      }
      
      // Fallback to copying URL
      await navigator.clipboard.writeText(imageUrl);
      toast({
        title: "تم النسخ!",
        description: "تم نسخ رابط التصميم إلى الحافظة",
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل في مشاركة التصميم",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card shadow-elegant">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 gradient-primary rounded-xl shadow-glow">
                <Palette className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gradient">لوحة تحكم المدير</h1>
                <p className="text-muted-foreground">
                  مرحباً {user.user_metadata?.name || user.email}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <NotificationBell userId={user.id} />
              <Button onClick={handleLogout} variant="outline" className="shadow-elegant">
                <LogOut className="h-4 w-4 ml-2" />
                تسجيل الخروج
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-md mx-auto">
            <TabsTrigger value="dashboard" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              لوحة التحكم
            </TabsTrigger>
            <TabsTrigger value="tasks" className="gap-2">
              <Target className="h-4 w-4" />
              إدارة المهام
            </TabsTrigger>
            <TabsTrigger value="designs" className="gap-2">
              <ImageIcon className="h-4 w-4" />
              التصاميم
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="shadow-elegant hover:shadow-glow transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">إجمالي التصاميم</CardTitle>
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <ImageIcon className="h-4 w-4 text-primary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">{stats.totalDesigns}</div>
                  <p className="text-xs text-muted-foreground">المجموع الكلي</p>
                </CardContent>
              </Card>
              
              <Card className="shadow-elegant hover:shadow-glow transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">المصممين النشطين</CardTitle>
                  <div className="p-2 bg-success/10 rounded-lg">
                    <Users className="h-4 w-4 text-success" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-success">{stats.activeDesigners}</div>
                  <p className="text-xs text-muted-foreground">مصمم مسجل</p>
                </CardContent>
              </Card>
              
              <Card className="shadow-elegant hover:shadow-glow transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">المهام المعلقة</CardTitle>
                  <div className="p-2 bg-warning/10 rounded-lg">
                    <Clock className="h-4 w-4 text-warning" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-warning">{stats.pendingTasks}</div>
                  <p className="text-xs text-muted-foreground">في الانتظار</p>
                </CardContent>
              </Card>

              <Card className="shadow-elegant hover:shadow-glow transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">المهام المكتملة</CardTitle>
                  <div className="p-2 bg-success/10 rounded-lg">
                    <CheckCircle className="h-4 w-4 text-success" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-success">{stats.completedTasks}</div>
                  <p className="text-xs text-muted-foreground">تم إنجازها</p>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card className="shadow-elegant">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  النشاط الأخير
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {designs.slice(0, 5).map((design) => (
                    <div key={design.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
                      <div className="h-12 w-12 rounded-lg overflow-hidden bg-muted">
                        {design.image_url ? (
                          <img src={design.image_url} alt={design.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <ImageIcon className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium">{design.name || "تصميم بدون عنوان"}</h4>
                        <p className="text-sm text-muted-foreground">
                          بواسطة {design.profiles?.name || "غير محدد"} • {formatDate(design.created_at)}
                        </p>
                      </div>
                      <Badge variant="secondary">جديد</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tasks">
            <TaskManager currentUserId={user.id} />
          </TabsContent>

          <TabsContent value="designs" className="space-y-6">
            {/* Filters */}
            <Card className="shadow-elegant">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5 text-primary" />
                  البحث والتصفية
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="ابحث في التصاميم أو أسماء المصممين..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pr-10"
                      />
                    </div>
                  </div>
                  <div className="w-full md:w-48">
                    <Select value={designerFilter} onValueChange={setDesignerFilter}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع المصممين</SelectItem>
                        {designers.map((designer) => (
                          <SelectItem key={designer.id} value={designer.id}>
                            {designer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    onClick={() => {
                      fetchDesigns();
                      fetchStats();
                    }} 
                    variant="outline" 
                    className="gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    تحديث
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Designs Grid */}
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">جاري تحميل التصاميم...</p>
              </div>
            ) : filteredDesigns.length === 0 ? (
              <Card className="shadow-elegant">
                <CardContent className="text-center py-12">
                  <ImageIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">لا توجد تصاميم</h3>
                  <p className="text-muted-foreground">
                    {searchTerm || designerFilter !== "all" 
                      ? "لم يتم العثور على تصاميم تطابق معايير البحث" 
                      : "لم يتم رفع أي تصاميم بعد"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredDesigns.map((design) => (
                  <Card key={design.id} className="overflow-hidden shadow-elegant hover:shadow-glow transition-all duration-300">
                    <div className="aspect-video bg-muted relative">
                      {design.image_url ? (
                        <img
                          src={design.image_url}
                          alt={design.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <ImageIcon className="h-12 w-12 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg line-clamp-1">
                            {design.name || "تصميم بدون عنوان"}
                          </CardTitle>
                          <p className="text-muted-foreground line-clamp-2 mt-1 text-sm">
                            {design.description || "لا يوجد وصف"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>{design.profiles?.name || "غير محدد"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(design.created_at)}</span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => handleDownload(design.image_url, design.name)}
                          disabled={!design.image_url}
                        >
                          <Download className="h-4 w-4 ml-1" />
                          تحميل
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => handleShare(design.image_url, design.name)}
                          disabled={!design.image_url}
                        >
                          <Share2 className="h-4 w-4 ml-1" />
                          مشاركة
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;