import React, { useState, useEffect } from 'react';
import { Plus, Calendar, User, Upload, Save, X, Eye, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

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
  profiles?: {
    name: string;
    email: string;
  } | null;
}

interface Designer {
  id: string;
  name: string;
  email: string;
}

interface TaskManagerProps {
  currentUserId: string;
}

const TaskManager: React.FC<TaskManagerProps> = ({ currentUserId }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [designers, setDesigners] = useState<Designer[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const { toast } = useToast();

  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    assigned_to: '',
    priority: 'medium',
    due_date: ''
  });

  useEffect(() => {
    fetchTasks();
    fetchDesigners();
  }, []);

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Fetch profiles separately to avoid join issues
      const tasksWithProfiles = await Promise.all(
        (data || []).map(async (task) => {
          if (task.assigned_to) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('name, email')
              .eq('id', task.assigned_to)
              .single();
            return { ...task, profiles: profileData };
          }
          return { ...task, profiles: null };
        })
      );
      
      setTasks(tasksWithProfiles as Task[]);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast({
        title: "خطأ",
        description: "فشل في تحميل المهام",
        variant: "destructive",
      });
    }
  };

  const fetchDesigners = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email')
        .eq('role', 'designer');

      if (error) throw error;
      setDesigners(data || []);
    } catch (error) {
      console.error('Error fetching designers:', error);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "خطأ",
          description: "حجم الملف يجب أن يكون أقل من 10 ميجابايت",
          variant: "destructive",
        });
        return;
      }
      setReferenceFile(file);
    }
  };

  const uploadReferenceImage = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
      const filePath = `reference/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('designs')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('designs')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error('Error uploading reference image:', error);
      return null;
    }
  };

  const createTask = async () => {
    if (!newTask.title.trim()) {
      toast({
        title: "خطأ",
        description: "يجب إدخال عنوان المهمة",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      let referenceImageUrl = null;
      if (referenceFile) {
        referenceImageUrl = await uploadReferenceImage(referenceFile);
      }

      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .insert({
          title: newTask.title,
          description: newTask.description,
          assigned_to: newTask.assigned_to || null,
          assigned_by: currentUserId,
          priority: newTask.priority,
          due_date: newTask.due_date || null,
          reference_image_url: referenceImageUrl
        })
        .select()
        .single();

      if (taskError) throw taskError;

      // Send notification to assigned designer
      if (newTask.assigned_to) {
        const { error: notificationError } = await supabase
          .rpc('send_notification', {
            p_user_id: newTask.assigned_to,
            p_title: 'مهمة جديدة',
            p_message: `تم تكليفك بمهمة جديدة: ${newTask.title}`,
            p_type: 'task',
            p_task_id: taskData.id
          });

        if (notificationError) {
          console.error('Error sending notification:', notificationError);
        }
      }

      toast({
        title: "نجح",
        description: "تم إنشاء المهمة بنجاح",
      });

      setNewTask({
        title: '',
        description: '',
        assigned_to: '',
        priority: 'medium',
        due_date: ''
      });
      setReferenceFile(null);
      setIsDialogOpen(false);
      fetchTasks();
    } catch (error) {
      console.error('Error creating task:', error);
      toast({
        title: "خطأ",
        description: "فشل في إنشاء المهمة",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ 
          status: newStatus,
          ...(newStatus === 'completed' && { completed_at: new Date().toISOString() })
        })
        .eq('id', taskId);

      if (error) throw error;

      toast({
        title: "نجح",
        description: "تم تحديث حالة المهمة",
      });

      fetchTasks();
    } catch (error) {
      console.error('Error updating task status:', error);
      toast({
        title: "خطأ",
        description: "فشل في تحديث حالة المهمة",
        variant: "destructive",
      });
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gradient">إدارة المهام</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary shadow-glow">
              <Plus className="h-4 w-4 ml-2" />
              مهمة جديدة
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>إنشاء مهمة جديدة</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">عنوان المهمة *</Label>
                <Input
                  id="title"
                  value={newTask.title}
                  onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="أدخل عنوان المهمة"
                />
              </div>

              <div>
                <Label htmlFor="description">الوصف</Label>
                <Textarea
                  id="description"
                  value={newTask.description}
                  onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="أدخل وصف المهمة"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="assigned_to">تكليف المصمم</Label>
                <Select value={newTask.assigned_to} onValueChange={(value) => setNewTask(prev => ({ ...prev, assigned_to: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر مصممًا" />
                  </SelectTrigger>
                  <SelectContent>
                    {designers.map((designer) => (
                      <SelectItem key={designer.id} value={designer.id}>
                        {designer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="priority">الأولوية</Label>
                <Select value={newTask.priority} onValueChange={(value) => setNewTask(prev => ({ ...prev, priority: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">منخفضة</SelectItem>
                    <SelectItem value="medium">متوسطة</SelectItem>
                    <SelectItem value="high">عالية</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="due_date">تاريخ التسليم</Label>
                <Input
                  id="due_date"
                  type="datetime-local"
                  value={newTask.due_date}
                  onChange={(e) => setNewTask(prev => ({ ...prev, due_date: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="reference">صورة مرجعية</Label>
                <Input
                  id="reference"
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="cursor-pointer"
                />
                {referenceFile && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {referenceFile.name}
                  </p>
                )}
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={createTask} disabled={loading} className="flex-1">
                  {loading ? (
                    <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"></div>
                  ) : (
                    <>
                      <Save className="h-4 w-4 ml-2" />
                      إنشاء المهمة
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  إلغاء
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {tasks.length === 0 ? (
          <Card className="text-center p-8">
            <div className="text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4" />
              <p>لا توجد مهام بعد</p>
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
                  {task.profiles && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>المصمم: {task.profiles.name}</span>
                    </div>
                  )}

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

                  {task.completed_design_url && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">التصميم المكتمل:</span>
                      <Button variant="outline" size="sm" asChild>
                        <a href={task.completed_design_url} target="_blank" rel="noopener noreferrer">
                          <Eye className="h-4 w-4 ml-1" />
                          عرض التصميم
                        </a>
                      </Button>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    {task.status !== 'completed' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateTaskStatus(task.id, 'in_progress')}
                          disabled={task.status === 'in_progress'}
                        >
                          بدء التنفيذ
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => updateTaskStatus(task.id, 'completed')}
                          className="bg-success hover:bg-success/90"
                        >
                          اكتمل
                        </Button>
                      </>
                    )}
                  </div>

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
  );
};

export default TaskManager;