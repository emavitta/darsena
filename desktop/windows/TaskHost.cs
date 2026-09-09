// A small .NET Framework host; Windows 10/11 include the runtime.
// Launch suspended, assign to a private job, then resume: descendants cannot
// escape between creation and assignment. Closing our handle kills the job.
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

class TaskHost {
    [StructLayout(LayoutKind.Sequential)] struct BasicLimits {
        public long PerProcessUserTimeLimit, PerJobUserTimeLimit;
        public uint LimitFlags;
        public UIntPtr MinimumWorkingSetSize, MaximumWorkingSetSize;
        public uint ActiveProcessLimit;
        public UIntPtr Affinity;
        public uint PriorityClass, SchedulingClass;
    }
    [StructLayout(LayoutKind.Sequential)] struct ExtendedLimits {
        public BasicLimits BasicLimitInformation;
        public ulong ReadOperationCount, WriteOperationCount, OtherOperationCount, ReadTransferCount, WriteTransferCount, OtherTransferCount;
        public UIntPtr ProcessMemoryLimit, JobMemoryLimit, PeakProcessMemoryUsed, PeakJobMemoryUsed;
    }
    [StructLayout(LayoutKind.Sequential)] struct Accounting {
        public long TotalUserTime, TotalKernelTime, ThisPeriodTotalUserTime, ThisPeriodTotalKernelTime;
        public uint TotalPageFaultCount, TotalProcesses, ActiveProcesses, TotalTerminatedProcesses;
    }
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] struct Startup {
        public uint cb;
        public string reserved, desktop, title;
        public uint x, y, width, height, xChars, yChars, fill, flags;
        public ushort show, reservedSize;
        public IntPtr reservedPtr, input, output, error;
    }
    [StructLayout(LayoutKind.Sequential)] struct ProcessInfo { public IntPtr process, thread; public uint pid, tid; }
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr attributes, string name);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr OpenJobObject(uint access, bool inherit, string name);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job, int kind, ref ExtendedLimits info, uint size);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr job, int kind, IntPtr info, uint size, IntPtr length);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool TerminateJobObject(IntPtr job, uint code);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool TerminateProcess(IntPtr process, uint code);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
    [DllImport("kernel32.dll")] static extern IntPtr GetStdHandle(int kind);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetHandleInformation(IntPtr handle, uint mask, uint flags);
    [DllImport("kernel32.dll", SetLastError=true)] static extern uint ResumeThread(IntPtr thread);
    [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr handle, uint timeout);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool GetExitCodeProcess(IntPtr process, out uint code);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool CreateProcess(string app, StringBuilder command, IntPtr pa, IntPtr ta, bool inherit, uint flags, IntPtr env, string cwd, ref Startup si, out ProcessInfo pi);
    static volatile bool stopping;
    static void Check(bool result) { if (!result) throw new Win32Exception(Marshal.GetLastWin32Error()); }
    static uint Count(IntPtr job) {
        int size = Marshal.SizeOf(typeof(Accounting));
        IntPtr data = Marshal.AllocHGlobal(size);
        try { Check(QueryInformationJobObject(job, 1, data, (uint)size, IntPtr.Zero)); return ((Accounting)Marshal.PtrToStructure(data, typeof(Accounting))).ActiveProcesses; }
        finally { Marshal.FreeHGlobal(data); }
    }
    static void List(string name) {
        IntPtr job = OpenJobObject(4, false, name);
        if (job == IntPtr.Zero) { Console.WriteLine("[]"); return; }
        try {
            for (int size=4096; size <= 1048576; size *= 2) {
                IntPtr data = Marshal.AllocHGlobal(size);
                try {
                    if (!QueryInformationJobObject(job, 3, data, (uint)size, IntPtr.Zero)) {
                        if (Marshal.GetLastWin32Error() == 234) continue;
                        Check(false);
                    }
                    int count = Marshal.ReadInt32(data, 4);
                    string[] ids = new string[count];
                    for (int i=0; i<count; i++) ids[i] = Marshal.ReadIntPtr(data, 8+i*IntPtr.Size).ToInt64().ToString();
                    Console.WriteLine("[" + string.Join(",", ids) + "]"); return;
                } finally { Marshal.FreeHGlobal(data); }
            }
            throw new Exception("Too many processes in this task.");
        } finally { CloseHandle(job); }
    }
    static int Main(string[] args) {
        IntPtr job = IntPtr.Zero;
        ProcessInfo child = new ProcessInfo();
        try {
            if (args.Length == 2 && args[0] == "--list") { List(args[1]); return 0; }
            if (args.Length != 3) throw new Exception("Expected a job name, executable and command line.");
            job = CreateJobObject(IntPtr.Zero, args[0]);
            Check(job != IntPtr.Zero);
            var limits = new ExtendedLimits();
            limits.BasicLimitInformation.LimitFlags = 0x2000; // KILL_ON_JOB_CLOSE, no breakaway
            Check(SetInformationJobObject(job, 9, ref limits, (uint)Marshal.SizeOf(typeof(ExtendedLimits))));
            var startup = new Startup();
            startup.cb = (uint)Marshal.SizeOf(typeof(Startup));
            startup.flags = 0x100; // STARTF_USESTDHANDLES
            startup.input = IntPtr.Zero; // non-interactive task; never inherit the control pipe
            startup.output = GetStdHandle(-11); startup.error = GetStdHandle(-12);
            Check(SetHandleInformation(startup.output, 1, 1));
            Check(SetHandleInformation(startup.error, 1, 1));
            Check(SetHandleInformation(GetStdHandle(-10), 1, 0));
            Check(CreateProcess(args[1], new StringBuilder(args[2]), IntPtr.Zero, IntPtr.Zero, true, 0x08000004, IntPtr.Zero, null, ref startup, out child));
            if (!AssignProcessToJobObject(job, child.process)) {
                int error = Marshal.GetLastWin32Error(); TerminateProcess(child.process, 1); throw new Win32Exception(error);
            }
            if (ResumeThread(child.thread) == uint.MaxValue) Check(false);
            new Thread(() => { try { Console.ReadLine(); } catch {} stopping = true; }) { IsBackground = true }.Start();
            bool rootExited = false, explained = false;
            uint exitCode = 0;
            while (Count(job) > 0) {
                if (stopping) { Check(TerminateJobObject(job, 1)); }
                if (!rootExited && WaitForSingleObject(child.process, 0) == 0) {
                    rootExited = true; Check(GetExitCodeProcess(child.process, out exitCode));
                }
                if (rootExited && !stopping && !explained && Count(job) > 0) {
                    Console.Error.WriteLine("[Darsena] Child processes remain active. Stop will terminate the entire task."); explained = true;
                }
                Thread.Sleep(40);
            }
            if (!rootExited) Check(GetExitCodeProcess(child.process, out exitCode));
            return unchecked((int)exitCode);
        } catch (Exception error) {
            Console.Error.WriteLine("[Darsena] " + error.Message); return 1;
        } finally {
            if (job != IntPtr.Zero) CloseHandle(job);
            if (child.thread != IntPtr.Zero) CloseHandle(child.thread);
            if (child.process != IntPtr.Zero) CloseHandle(child.process);
        }
    }
}
