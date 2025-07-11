import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  LogOut, 
  Download, 
  Share2, 
  Search, 
  Filter, 
  Calendar,
  User2,
  Image,
  RefreshCw
} from "lucide-react";

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
  const { toast } = useToast();

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

  const handleDownload = (imageUrl: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = fileName || 'design';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShare = async (imageUrl: string) => {
    try {
      await navigator.clipboard.writeText(imageUrl);
      toast({
        title: "تم النسخ!",
        description: "تم نسخ رابط التصميم إلى الحافظة",
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل في نسخ الرابط",
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
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Image className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">لوحة تحكم المدير</h1>
                <p className="text-sm text-muted-foreground">
                  مرحباً {user.user_metadata?.name || user.email}
                </p>
              </div>
            </div>
            <Button onClick={handleLogout} variant="outline" size="sm">
              <LogOut className="h-4 w-4 ml-2" />
              تسجيل الخروج
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">إجمالي التصاميم</CardTitle>
              <Image className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{designs.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">المصممين النشطين</CardTitle>
              <User2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{designers.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">التصاميم المفلترة</CardTitle>
              <Filter className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredDesigns.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
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
              <Button onClick={fetchDesigns} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 ml-2" />
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
          <Card>
            <CardContent className="text-center py-12">
              <Image className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
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
              <Card key={design.id} className="overflow-hidden">
                <div className="aspect-video bg-muted relative">
                  {design.image_url ? (
                    <img
                      src={design.image_url}
                      alt={design.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <Image className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg line-clamp-1">
                        {design.name || "تصميم بدون عنوان"}
                      </CardTitle>
                      <CardDescription className="line-clamp-2 mt-1">
                        {design.description || "لا يوجد وصف"}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User2 className="h-4 w-4" />
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
                      onClick={() => handleShare(design.image_url)}
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
      </div>
    </div>
  );
};

export default AdminDashboard;