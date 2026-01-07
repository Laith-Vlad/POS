import { useState } from 'react';
import Modal from './Modal';
import { useApp } from '../context/AppContext';
import { showToast } from '../utils/toast';

interface PINModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
}

export default function PINModal({ isOpen, onClose, onConfirm, title = 'Manager Approval Required', message = 'Enter Manager PIN:' }: PINModalProps) {
  const { state } = useApp();
  const [pin, setPin] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === state.settings.managerPIN) {
      onConfirm();
      setPin('');
      onClose();
    } else {
      showToast('Invalid PIN', 'error');
    }
  };

  const handleClose = () => {
    setPin('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title} size="sm">
      <form onSubmit={handleSubmit}>
        <p className="text-sm text-gray-600 mb-4">{message}</p>
        <input
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="Enter PIN"
          autoFocus
        />
        <div className="mt-4 flex justify-end space-x-2">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
          >
            Confirm
          </button>
        </div>
      </form>
    </Modal>
  );
}
