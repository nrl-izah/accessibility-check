import { h } from 'preact'

const Popover = ({ message, isOpen, onClose }: { message: string; isOpen: boolean; onClose: () => void }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
      <div className="relative bg-white p-4 rounded-lg shadow-lg w-80">
        {/* Arrow for popover */}
        {/* <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-white rotate-45 shadow-md"></div> */}

        {/* Close Button */}
        <button className="absolute top-2 right-2 text-gray-600 hover:text-black" onClick={onClose}>âœ–</button>

        {/* Title and Message */}
        <h3 className="text-lg font-semibold text-gray-700 mb-2">Disclaimer</h3>
        <p className="text-sm text-gray-700">{message}</p>
      </div>
    </div>
  );
};

export default Popover;