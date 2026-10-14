
import { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FileText, Edit, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Account = {
  id: string;
  code: string | null;
  name: string;
  type: string;
  isGroup: boolean;
  parentId: string | null;
  isSystem: boolean;
  balance?: number;
  children?: Account[];
};

interface AccountTreeProps {
  accounts: Account[];
  onEdit: (account: Account) => void;
  onDelete: (id: string) => void;
}

const TreeNode = ({ node, level, onEdit, onDelete }: { node: Account; level: number; onEdit: (a: Account) => void; onDelete: (id: string) => void }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasChildren = node.children && node.children.length > 0;

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div>
      <div 
        className={cn(
            "flex items-center py-2 px-2 hover:bg-accent/50 rounded-md group transition-colors",
            level > 0 && "ml-6" // Indentation
        )}
      >
        {/* Expand/Collapse Icon */}
        <button 
          onClick={handleToggle}
          className={cn(
            "p-1 mr-1 rounded-sm hover:bg-accent text-muted-foreground",
            !hasChildren && "invisible"
          )}
        >
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        {/* Icon based on Group/Leaf */}
        <div className="mr-2 text-muted-foreground">
            {node.isGroup ? (
                <Folder className="h-4 w-4 text-blue-500" />
            ) : (
                <FileText className="h-4 w-4 text-gray-400" />
            )}
        </div>

        {/* Account Info */}
        <div className="flex-1 flex items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">{node.code}</span>
            <span className="text-sm font-medium text-foreground">{node.name}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-accent text-muted-foreground ml-2">
                {node.type}
            </span>
        </div>

        {node.balance != null && !node.isGroup && (
          <span
            className={cn(
              "font-mono text-xs font-semibold mr-3",
              Number(node.balance) < 0
                ? "text-rose-600 dark:text-rose-400"
                : "text-emerald-700 dark:text-emerald-400"
            )}
          >
            Rs {Number(node.balance).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        )}

        {/* Actions */}
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
            <Tooltip>
                <TooltipTrigger asChild>
                    <button 
                        onClick={() => onEdit(node)} 
                        className="p-1.5 text-minia-primary hover:bg-minia-primary/10 rounded"
                        aria-label="Edit"
                        type="button"
                    >
                        <Edit className="h-3.5 w-3.5" />
                    </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                    <p>Edit</p>
                </TooltipContent>
            </Tooltip>
            {!node.isSystem && (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button 
                            onClick={() => onDelete(node.id)} 
                            className="p-1.5 text-minia-danger hover:bg-minia-danger/10 rounded"
                            aria-label="Delete"
                            type="button"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                        <p>Delete</p>
                    </TooltipContent>
                </Tooltip>
            )}
        </div>
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div className="border-l border-border ml-4 pl-1">
          {node.children!.map((child) => (
            <TreeNode 
                key={child.id} 
                node={child} 
                level={level + 1} 
                onEdit={onEdit} 
                onDelete={onDelete} 
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function AccountTree({ accounts, onEdit, onDelete }: AccountTreeProps) {
  // Build Tree Structure
  const buildTree = (accounts: Account[]) => {
    const map = new Map<string, Account>();
    const roots: Account[] = [];

    // Initialize map with a copy of objects and empty children array
    accounts.forEach(acc => {
        map.set(acc.id, { ...acc, children: [] });
    });

    // Link children to parents
    accounts.forEach(acc => {
        const node = map.get(acc.id)!;
        if (acc.parentId && map.has(acc.parentId)) {
            map.get(acc.parentId)!.children!.push(node);
        } else {
            roots.push(node);
        }
    });

    return roots;
  };

  const treeData = buildTree(accounts);

  if (treeData.length === 0) {
      return <div className="p-8 text-center text-muted-foreground">No accounts found.</div>;
  }

  return (
    <div className="space-y-1">
      {treeData.map((node) => (
        <TreeNode 
            key={node.id} 
            node={node} 
            level={0} 
            onEdit={onEdit} 
            onDelete={onDelete} 
        />
      ))}
    </div>
  );
}
