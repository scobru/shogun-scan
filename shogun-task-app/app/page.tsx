"use client";

import type React from "react";

import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { Plus, Trash2, List, LogOut } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useGun } from "@/lib/gun-context";
import { TaskList } from "@/components/task-list";
import { NewListDialog } from "@/components/new-list-dialog";
import { AuthFormEnhanced } from "@/components/auth-form-enhanced";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type TaskType = {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
};

type ListType = {
  id: string;
  name: string;
  createdAt: number;
};

export default function TaskApp() {
  const { gun, user, isAuthenticated, logout } = useGun();
  const [tasks, setTasks] = useState<TaskType[]>([]);
  const [newTask, setNewTask] = useState("");
  const [lists, setLists] = useState<ListType[]>([]);
  const [currentList, setCurrentList] = useState("default");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isListsOpen, setIsListsOpen] = useState(false);
  const [deleteListDialog, setDeleteListDialog] = useState<{
    isOpen: boolean;
    listId: string | null;
  }>({
    isOpen: false,
    listId: null,
  });

  // Gestione delle liste
  useEffect(() => {
    if (!gun || !user || !isAuthenticated) {
      setTasks([]);
      setLists([]);
      return;
    }

    // Inizializza la lista predefinita
    const defaultList = {
      name: "Lista Predefinita",
      createdAt: Date.now(),
    };

    gun
      .user()
      .get("lists")
      .get("default")
      .once((list) => {
        if (!list) {
          gun.user().get("lists").get("default").put(defaultList);
        }
      });

    // Sottoscrizione alle liste
    const listsRef = gun.user().get("lists");

    const updateLists = (data: any, id: string) => {
      if (data === null) {
        setLists((prev) => prev.filter((l) => l.id !== id));
        return;
      }

      if (data && typeof data === "object" && !Array.isArray(data)) {
        setLists((prev) => {
          const existingIndex = prev.findIndex((l) => l.id === id);
          const newList = { id, ...data };

          if (existingIndex >= 0) {
            const newLists = [...prev];
            newLists[existingIndex] = newList;
            return newLists;
          }

          return [...prev, newList];
        });
      }
    };

    listsRef.map().on(updateLists);

    return () => {
      listsRef.map().off();
    };
  }, [gun, user, isAuthenticated]);

  // Gestione delle attività
  useEffect(() => {
    if (!gun || !user || !isAuthenticated || !currentList) return;

    setTasks([]); // Reset tasks when changing list

    const tasksRef = gun.user().get("tasks").get(currentList);

    const updateTasks = (data: any, id: string) => {
      if (data === null) {
        setTasks((prev) => prev.filter((t) => t.id !== id));
        return;
      }

      if (data && typeof data === "object" && !Array.isArray(data)) {
        setTasks((prev) => {
          const existingIndex = prev.findIndex((t) => t.id === id);
          const newTask = { id, ...data };

          if (existingIndex >= 0) {
            const newTasks = [...prev];
            newTasks[existingIndex] = newTask;
            return newTasks;
          }

          return [...prev, newTask];
        });
      }
    };

    tasksRef.map().on(updateTasks);

    return () => {
      tasksRef.map().off();
    };
  }, [gun, user, isAuthenticated, currentList]);

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim() || !user || !isAuthenticated) return;

    const id = Date.now().toString();
    const newTaskData = {
      title: newTask,
      completed: false,
      createdAt: Date.now(),
    };

    gun.user().get("tasks").get(currentList).get(id).put(newTaskData);
    setNewTask("");
  };

  const toggleTask = (id: string, completed: boolean) => {
    if (!user || !isAuthenticated) return;
    gun
      .user()
      .get("tasks")
      .get(currentList)
      .get(id)
      .get("completed")
      .put(!completed);
  };

  const deleteTask = (id: string) => {
    if (!user || !isAuthenticated) return;
    gun.user().get("tasks").get(currentList).get(id).put(null);
  };

  const deleteList = (id: string) => {
    if (!user || !isAuthenticated || id === "default") return;

    // Elimina la lista
    gun.user().get("lists").get(id).put(null);

    // Elimina tutte le attività associate
    gun
      .user()
      .get("tasks")
      .get(id)
      .map()
      .once((task, taskId) => {
        if (task) {
          gun.user().get("tasks").get(id).get(taskId).put(null);
        }
      });

    // Se la lista corrente è quella eliminata, torna alla lista predefinita
    if (currentList === id) {
      setCurrentList("default");
    }

    setDeleteListDialog({ isOpen: false, listId: null });
  };

  const createNewList = (name: string) => {
    if (!user || !isAuthenticated || !name.trim()) return;

    const id = Date.now().toString();
    const newList = {
      name: name.trim(),
      createdAt: Date.now(),
    };

    gun?.user().get("lists").get(id).put(newList);
    setCurrentList(id);
    setIsDialogOpen(false);
  };

  const switchList = (id: string) => {
    setCurrentList(id);
    setIsListsOpen(false);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <AuthFormEnhanced />
      </div>
    );
  }

  const currentListName =
    lists.find((l) => l.id === currentList)?.name || "Attività";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b p-4 bg-card">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold">Tasks</h1>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsListsOpen(true)}
            >
              <List className="h-4 w-4 mr-2" />
              Liste
            </Button>
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">{currentListName}</h2>
              {currentList !== "default" && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() =>
                    setDeleteListDialog({
                      isOpen: true,
                      listId: currentList,
                    })
                  }
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Elimina lista
                </Button>
              )}
            </div>

            <form onSubmit={addTask} className="flex gap-2 mb-6">
              <Input
                placeholder="Aggiungi un'attività..."
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                className="flex-1"
              />
              <Button type="submit">
                <Plus className="h-4 w-4 mr-2" />
                Aggiungi
              </Button>
            </form>

            <div className="space-y-2">
              {tasks
                .sort((a, b) => b.createdAt - a.createdAt)
                .map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 p-3 border rounded-md bg-card"
                  >
                    <Checkbox
                      checked={task.completed}
                      onCheckedChange={() =>
                        toggleTask(task.id, task.completed)
                      }
                    />
                    <span
                      className={`flex-1 ${
                        task.completed
                          ? "line-through text-muted-foreground"
                          : ""
                      }`}
                    >
                      {task.title}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteTask(task.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}

              {tasks.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Nessuna attività. Aggiungine una sopra!
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <TaskList
        lists={lists}
        currentList={currentList}
        onSelectList={switchList}
        isOpen={isListsOpen}
        onClose={() => setIsListsOpen(false)}
        onNewList={() => {
          setIsListsOpen(false);
          setIsDialogOpen(true);
        }}
      />

      <NewListDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onCreateList={createNewList}
      />

      <AlertDialog
        open={deleteListDialog.isOpen}
        onOpenChange={(isOpen) => setDeleteListDialog({ isOpen, listId: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata. Verranno eliminate tutte
              le attività in questa lista.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteListDialog.listId && deleteList(deleteListDialog.listId)
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
