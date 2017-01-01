Facter.add(:laptop) do
  confine :kernel => 'Linux'

  setcode do
    laptop_detect = Facter::Core::Execution.which('laptop-detect')
    system(laptop_detect) if laptop_detect
  end
end
