import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { ArrowLeft, UserPlus, UserMinus, Search, Users } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { PhoneLink } from '../components/ui/PhoneLink';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
function getHeaders() {
  const token = useAuthStore.getState().token;
  return { Authorization: `Bearer ${token}` };
}

export default function GroupMembers() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addSearch, setAddSearch] = useState('');

  // Group details
  const { data: group } = useQuery({
    queryKey: ['group', id],
    queryFn: async () => {
      const { data } = await axios.get(`${API}/groups/${id}`, { headers: getHeaders() });
      return data;
    },
  });

  // Members in this group
  const { data: members, isLoading } = useQuery({
    queryKey: ['group-members', id],
    queryFn: async () => {
      const { data } = await axios.get(`${API}/groups/${id}/members`, { headers: getHeaders() });
      return data;
    },
  });

  // Customers not in any group (for adding)
  const { data: availableCustomers } = useQuery({
    queryKey: ['customers-no-group', addSearch],
    queryFn: async () => {
      const { data } = await axios.get(`${API}/customers?search=${addSearch}&limit=50`, { headers: getHeaders() });
      return data;
    },
    enabled: showAddModal,
  });

  const removeMember = useMutation({
    mutationFn: (customerId: string) =>
      axios.delete(`${API}/groups/${id}/members/${customerId}`, { headers: getHeaders() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group-members', id] });
      qc.invalidateQueries({ queryKey: ['group', id] });
    },
  });

  const addMember = useMutation({
    mutationFn: (customerId: string) =>
      axios.post(`${API}/groups/${id}/members/${customerId}`, {}, { headers: getHeaders() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group-members', id] });
      qc.invalidateQueries({ queryKey: ['group', id] });
      qc.invalidateQueries({ queryKey: ['customers-no-group'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || 'Failed to add member');
    },
  });

  const filteredMembers = (members || []).filter((m: any) =>
    m.name?.toLowerCase().includes(search.toLowerCase()) ||
    m.mobile?.includes(search)
  );

  const ungroupedCustomers = (availableCustomers?.customers || []).filter(
    (c: any) => !c.group_id
  );

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-secondary p-2">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="page-title">{group?.name} — Members</h1>
          <p className="text-sm text-slate-500">{group?.center_name} • {members?.length || 0} members</p>
        </div>
        <button className="btn-primary ml-auto" onClick={() => setShowAddModal(true)}>
          <UserPlus size={16} /> Add Member
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="input pl-9"
          placeholder="Search members..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Members list */}
      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-7 h-7 border-4 border-navy-800 border-t-transparent rounded-full" />
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Users size={36} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No members {search ? 'found' : 'in this group'}</p>
            {!search && <p className="text-sm mt-1">Add customers to get started</p>}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredMembers.map((member: any) => (
              <div key={member.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/60 transition-colors">
                <div className="w-10 h-10 rounded-full bg-navy-100 flex items-center justify-center text-navy-700 font-bold text-sm shrink-0">
                  {member.photo ? (
                    <img src={member.photo} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    member.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-slate-800">{member.name}</p>
                  <PhoneLink phone={member.mobile} className="text-xs" iconSize={11} />
                  {member.loan_no && (
                    <p className="text-xs text-navy-600 mt-0.5">
                      Loan: {member.loan_no} • EMI: ₹{Number(member.emi_amount).toLocaleString('en-IN')}
                      <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${member.loan_status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {member.loan_status}
                      </span>
                    </p>
                  )}
                </div>
                <button
                  onClick={() => { if (window.confirm(`Remove ${member.name} from this group?`)) removeMember.mutate(member.id); }}
                  className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                  title="Remove from group"
                >
                  <UserMinus size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-bold text-navy-900">Add Member to Group</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div className="p-4">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="input pl-9"
                  placeholder="Search customers..."
                  value={addSearch}
                  onChange={e => setAddSearch(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
              {ungroupedCustomers.length === 0 ? (
                <p className="text-center text-slate-400 py-8 text-sm">No available customers (without a group)</p>
              ) : (
                ungroupedCustomers.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 border border-slate-100">
                    <div>
                      <p className="font-medium text-sm">{c.name}</p>
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <PhoneLink phone={c.mobile} iconSize={10} />
                        <span>•</span>{c.center_name || 'No center'}
                      </p>
                    </div>
                    <button
                      className="btn-primary text-xs py-1.5 px-3"
                      onClick={() => addMember.mutate(c.id)}
                      disabled={addMember.isPending}
                    >
                      <UserPlus size={14} /> Add
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="px-4 pb-4">
              <button className="btn-secondary w-full" onClick={() => setShowAddModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
