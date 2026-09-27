using System;
using System.Diagnostics;

namespace CollegeFeeManagement
{
    class StopProgram
    {
        [STAThread]
        static void Main(string[] args)
        {
            try
            {
                string portStr = Environment.GetEnvironmentVariable("PORT");
                int port = 5000;
                if (!string.IsNullOrEmpty(portStr)) int.TryParse(portStr, out port);
                if (port <= 0) port = 5000;

                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = "powershell.exe";
                psi.Arguments = string.Format("-NoProfile -Command \"Get-NetTCPConnection -LocalPort {0} -ErrorAction SilentlyContinue | ForEach-Object {{ Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }}\"", port);
                psi.CreateNoWindow = true;
                psi.UseShellExecute = false;
                psi.WindowStyle = ProcessWindowStyle.Hidden;
                Process p = Process.Start(psi);
                if (p != null) p.WaitForExit(4000);
            }
            catch { }
        }
    }
}
