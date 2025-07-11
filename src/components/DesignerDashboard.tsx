import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  LogOut, 
  Upload, 
  Image as ImageIcon,
  Plus,
  Calendar,
  FileImage,
  RefreshCw
} from "lucide-react";

interface Design {
  id: number;
  name: string;
  description: string;
  image_url: string;
  created_at: string;
}

interface DesignerDashboardProps {
  user: User;
}

const DesignerDashboard = ({ user }: DesignerDashboardProps) => {
  const [designs, setDesigns] = useState<Design[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();

  const fetchDesigns = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('designs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        toast({
          title: "خطأ",
          description: "حدث خطأ في تحميل التصاميم",
          variant: "destructive",
        });
      } else {
        setDesigns(data || []);
      }
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
  }, [user.id]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "خطأ",
          description: "حجم الملف كبير جداً. الحد الأقصى 10 ميجابايت",
          variant: "destructive",
        });
        return;
      }
      
      // Check file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "خطأ",
          description: "يرجى اختيار ملف صورة صحيح",
          variant: "destructive",
        });
        return;
      }
      
      setSelectedFile(file);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال عنوان للتصميم",
        variant: "destructive",
      });
      return;
    }

    if (!selectedFile) {
      toast({
        title: "خطأ",
        description: "يرجى اختيار ملف التصميم",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      // Upload file to Supabase Storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError, data } = await supabase.storage
        .from('designs')
        .upload(fileName, selectedFile);

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('designs')
        .getPublicUrl(fileName);

      // Save design record
      const { error: insertError } = await supabase
        .from('designs')
        .insert({
          name: title.trim(),
          description: description.trim(),
          image_url: publicUrl,
          user_id: user.id,
        });

      if (insertError) {
        throw insertError;
      }

      toast({
        title: "تم الرفع بنجاح!",
        description: "تم رفع التصميم وحفظه في النظام",
      });

      // Reset form
      setTitle("");
      setDescription("");
      setSelectedFile(null);
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      // Refresh designs list
      fetchDesigns();

    } catch (error: any) {
      toast({
        title: "خطأ في الرفع",
        description: error.message || "حدث خطأ أثناء رفع التصميم",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
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
                <ImageIcon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">لوحة المصمم</h1>
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upload Form */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  رفع تصميم جديد
                </CardTitle>
                <CardDescription>
                  قم برفع تصميمك مع إضافة العنوان والوصف المناسب
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpload} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">عنوان التصميم</Label>
                    <Input
                      id="title"
                      placeholder="أدخل عنوان التصميم"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="description">وصف التصميم</Label>
                    <Textarea
                      id="description"
                      placeholder="أدخل وصف مفصل للتصميم (اختياري)"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="file-input">ملف التصميم</Label>
                    <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                      <input
                        id="file-input"
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <label htmlFor="file-input" className="cursor-pointer">
                        <FileImage className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground mb-1">
                          {selectedFile ? selectedFile.name : "اختر ملف الصورة"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          JPG, PNG, GIF حتى 10MB
                        </p>
                      </label>
                    </div>
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={uploading}
                  >
                    {uploading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2"></div>
                        جاري الرفع...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 ml-2" />
                        رفع التصميم
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Designs List */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <ImageIcon className="h-5 w-5" />
                      تصاميمي ({designs.length})
                    </CardTitle>
                    <CardDescription>
                      جميع التصاميم التي قمت برفعها
                    </CardDescription>
                  </div>
                  <Button onClick={fetchDesigns} variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4 ml-2" />
                    تحديث
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">جاري تحميل التصاميم...</p>
                  </div>
                ) : designs.length === 0 ? (
                  <div className="text-center py-12">
                    <ImageIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">لا توجد تصاميم</h3>
                    <p className="text-muted-foreground">
                      قم برفع تصميمك الأول باستخدام النموذج على اليمين
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {designs.map((design) => (
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
                              <ImageIcon className="h-12 w-12 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <CardHeader>
                          <CardTitle className="text-base line-clamp-1">
                            {design.name}
                          </CardTitle>
                          {design.description && (
                            <CardDescription className="line-clamp-2">
                              {design.description}
                            </CardDescription>
                          )}
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            <span>{formatDate(design.created_at)}</span>
                          </div>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DesignerDashboard;