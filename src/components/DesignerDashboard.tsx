import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import NotificationBell from "@/components/NotificationBell";
import { 
  LogOut, 
  Upload, 
  Image as ImageIcon,
  Plus,
  Calendar,
  FileImage,
  RefreshCw,
  CheckCircle,
  Clock,
  AlertCircle,
  User as UserIcon,
  Eye
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface Design {
  id: number;
  name: string;
  description: string;
  image_url: string;
  created_at: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  reference_image_url?: string;
  assigned_to?: string;
  assigned_by: string;
  status: string;
  priority: string;
  due_date?: string;
  completed_design_url?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

interface DesignerDashboardProps {
  user: User;
}

const DesignerDashboard = ({ user }: DesignerDashboardProps) => {
  const [designs, setDesigns] = useState<Design[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [completedFile, setCompletedFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<'designs' | 'tasks'>('tasks');
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

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('assigned_to', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast({
        title: "خطأ",
        description: "فشل في تحميل المهام",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchDesigns();
    fetchTasks();
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

  const updateTaskStatus = async (taskId: string, newStatus: string, completedDesignUrl?: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ 
          status: newStatus,
          ...(newStatus === 'completed' && { 
            completed_at: new Date().toISOString(),
            completed_design_url: completedDesignUrl 
          })
        })
        .eq('id', taskId);

      if (error) throw error;

      // Send notification to admin when task is completed
      if (newStatus === 'completed') {
        const task = tasks.find(t => t.id === taskId);
        if (task) {
          await supabase.rpc('send_notification', {
            p_user_id: task.assigned_by,
            p_title: 'تم إكمال المهمة',
            p_message: `تم إكمال المهمة "${task.title}" بواسطة ${user.user_metadata?.name || user.email}`,
            p_type: 'task_completed',
            p_task_id: taskId
          });
        }
      }

      toast({
        title: "تم التحديث",
        description: "تم تحديث حالة المهمة بنجاح",
      });

      fetchTasks();
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: "خطأ",
        description: "فشل في تحديث المهمة",
        variant: "destructive",
      });
    }
  };

  const uploadCompletedDesign = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `completed/${user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('designs')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('designs')
        .getPublicUrl(fileName);

      return data.publicUrl;
    } catch (error) {
      console.error('Error uploading completed design:', error);
      return null;
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    if (!completedFile) {
      toast({
        title: "خطأ",
        description: "يرجى اختيار ملف التصميم المكتمل",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const completedDesignUrl = await uploadCompletedDesign(completedFile);
      if (completedDesignUrl) {
        await updateTaskStatus(taskId, 'completed', completedDesignUrl);
        setCompletedFile(null);
      }
    } catch (error) {
      console.error('Error completing task:', error);
    } finally {
      setUploading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />في الانتظار</Badge>;
      case 'in_progress':
        return <Badge variant="default" className="gap-1"><AlertCircle className="h-3 w-3" />قيد التنفيذ</Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-success gap-1"><CheckCircle className="h-3 w-3" />مكتملة</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge variant="destructive">عالية</Badge>;
      case 'medium':
        return <Badge variant="default">متوسطة</Badge>;
      case 'low':
        return <Badge variant="secondary">منخفضة</Badge>;
      default:
        return <Badge variant="secondary">{priority}</Badge>;
    }
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
                <h1 className="text-2xl font-bold text-gradient">لوحة المصمم</h1>
                <p className="text-sm text-muted-foreground">
                  مرحباً {user.user_metadata?.name || user.email}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <NotificationBell userId={user.id} />
              <Button onClick={handleLogout} variant="outline" size="sm">
                <LogOut className="h-4 w-4 ml-2" />
                تسجيل الخروج
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Navigation Tabs */}
        <div className="flex gap-4 mb-6">
          <Button
            variant={activeTab === 'tasks' ? 'default' : 'outline'}
            onClick={() => setActiveTab('tasks')}
            className="flex items-center gap-2"
          >
            <UserIcon className="h-4 w-4" />
            المهام المكلف بها ({tasks.length})
          </Button>
          <Button
            variant={activeTab === 'designs' ? 'default' : 'outline'}
            onClick={() => setActiveTab('designs')}
            className="flex items-center gap-2"
          >
            <ImageIcon className="h-4 w-4" />
            تصاميمي ({designs.length})
          </Button>
        </div>

        {activeTab === 'tasks' ? (
          /* Tasks Section */
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gradient">المهام المكلف بها</h2>
            <div className="grid gap-4">
              {tasks.length === 0 ? (
                <Card className="text-center p-8">
                  <div className="text-muted-foreground">
                    <UserIcon className="h-12 w-12 mx-auto mb-4" />
                    <p>لا توجد مهام مكلف بها</p>
                  </div>
                </Card>
              ) : (
                tasks.map((task) => (
                  <Card key={task.id} className="shadow-elegant hover:shadow-glow transition-all duration-300">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{task.title}</CardTitle>
                          <p className="text-muted-foreground text-sm mt-1">{task.description}</p>
                        </div>
                        <div className="flex gap-2">
                          {getStatusBadge(task.status)}
                          {getPriorityBadge(task.priority)}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {task.due_date && (
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span>تاريخ التسليم: {format(new Date(task.due_date), 'PPpp', { locale: ar })}</span>
                          </div>
                        )}

                        {task.reference_image_url && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">صورة مرجعية:</span>
                            <Button variant="outline" size="sm" asChild>
                              <a href={task.reference_image_url} target="_blank" rel="noopener noreferrer">
                                <Eye className="h-4 w-4 ml-1" />
                                عرض
                              </a>
                            </Button>
                          </div>
                        )}

                        {task.status !== 'completed' && (
                          <div className="space-y-3 pt-2 border-t">
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateTaskStatus(task.id, 'in_progress')}
                                disabled={task.status === 'in_progress'}
                              >
                                بدء التنفيذ
                              </Button>
                            </div>
                            
                            {task.status === 'in_progress' && (
                              <div className="space-y-2">
                                <Label htmlFor={`completed-file-${task.id}`}>رفع التصميم المكتمل</Label>
                                <Input
                                  id={`completed-file-${task.id}`}
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => setCompletedFile(e.target.files?.[0] || null)}
                                />
                                {completedFile && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleCompleteTask(task.id)}
                                    disabled={uploading}
                                    className="bg-success hover:bg-success/90"
                                  >
                                    {uploading ? 'جاري الرفع...' : 'إكمال المهمة'}
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="text-xs text-muted-foreground pt-2 border-t">
                          تم الإنشاء: {format(new Date(task.created_at), 'PPpp', { locale: ar })}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        ) : (
          /* Designs Section */
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
        )}
      </div>
    </div>
  );
};

export default DesignerDashboard;